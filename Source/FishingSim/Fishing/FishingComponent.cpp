#include "Fishing/FishingComponent.h"
#include "Fishing/FishingLureActor.h"
#include "Fishing/FishBiteModel.h"
#include "World/FishingZone.h"
#include "World/FishingWorldSubsystem.h"
#include "Economy/FishingProfileSubsystem.h"
#include "Data/FishSpeciesData.h"
#include "Core/FishingSettings.h"
#include "FishingSim.h"
#include "DrawDebugHelpers.h"
#include "Engine/GameInstance.h"
#include "Engine/World.h"
#include "GameFramework/Pawn.h"

#define LOCTEXT_NAMESPACE "Fishing"

UFishingComponent::UFishingComponent()
{
	PrimaryComponentTick.bCanEverTick = true;
	LureClass = AFishingLureActor::StaticClass();
}

void UFishingComponent::BeginPlay()
{
	Super::BeginPlay();
	if (UFishingProfileSubsystem* Profile = GetProfile())
	{
		Profile->OnLoadoutChanged.AddDynamic(this, &UFishingComponent::HandleProfileLoadoutChanged);
	}
	RefreshLoadoutFromProfile();
}

void UFishingComponent::EndPlay(const EEndPlayReason::Type EndPlayReason)
{
	if (UFishingProfileSubsystem* Profile = GetProfile())
	{
		Profile->OnLoadoutChanged.RemoveDynamic(this, &UFishingComponent::HandleProfileLoadoutChanged);
	}
	DestroyLure();
	Super::EndPlay(EndPlayReason);
}

UFishingProfileSubsystem* UFishingComponent::GetProfile() const
{
	const UWorld* MyWorld = GetWorld();
	UGameInstance* GI = MyWorld ? MyWorld->GetGameInstance() : nullptr;
	return GI ? GI->GetSubsystem<UFishingProfileSubsystem>() : nullptr;
}

// ============================================================================
// Тик и машина состояний
// ============================================================================

void UFishingComponent::TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction)
{
	Super::TickComponent(DeltaTime, TickType, ThisTickFunction);

	StateTimer += DeltaTime;
	switch (FishingState)
	{
	case EFishingState::ChargingCast:	TickCharging(DeltaTime); break;
	case EFishingState::LureFlying:		TickFlying(DeltaTime); break;
	case EFishingState::InWater:		TickInWater(DeltaTime); break;
	case EFishingState::Bite:			TickBite(DeltaTime); break;
	case EFishingState::Fighting:		TickFighting(DeltaTime); break;
	case EFishingState::Lost:			TickLost(DeltaTime); break;
	default: break;
	}

	if (FishingState != EFishingState::Fighting)
	{
		TensionKg = FMath::FInterpTo(TensionKg, 0.f, DeltaTime, 6.f);
		bDragSlipping = false;
	}

	DrawDebugTackle();
}

void UFishingComponent::SetState(EFishingState NewState)
{
	if (NewState == FishingState)
	{
		return;
	}
	const EFishingState OldState = FishingState;
	FishingState = NewState;
	StateTimer = 0.f;

	if (NewState == EFishingState::Idle)
	{
		ReelInput01 = 0.f;
		LineOutM = 0.f;
		CurrentZone.Reset();
		ApplyPendingLoadout();
	}
	OnStateChanged.Broadcast(NewState, OldState);
}

void UFishingComponent::TickCharging(float DeltaTime)
{
	CastCharge = FMath::Min(1.f, CastCharge + DeltaTime / FMath::Max(0.1f, ChargeTime));
}

void UFishingComponent::TickFlying(float DeltaTime)
{
	if (!Lure || !Loadout.Reel)
	{
		SetState(EFishingState::Idle);
		return;
	}
	LineOutM = static_cast<float>(FVector::Dist(GetRodTipLocation(), Lure->GetActorLocation())) / 100.f;
	if (LineOutM >= Loadout.Reel->LineCapacityM)
	{
		Lure->StopHorizontalMotion();
	}
}

void UFishingComponent::TickInWater(float DeltaTime)
{
	AFishingZone* Zone = CurrentZone.Get();
	if (!Lure || !Zone || !Loadout.IsComplete())
	{
		DestroyLure();
		SetState(EFishingState::Idle);
		return;
	}

	const URodData* Rod = Loadout.Rod;
	const UReelData* Reel = Loadout.Reel;
	const UBaitData* Bait = Loadout.Bait;

	const FVector Tip = GetRodTipLocation();
	FVector LurePos = Lure->GetActorLocation();
	const float SurfaceZ = Zone->GetWaterSurfaceZ();

	// --- Проводка: приманка движется к рыбаку ---
	FVector2D ToTip(Tip.X - LurePos.X, Tip.Y - LurePos.Y);
	float HorizDistCm = static_cast<float>(ToTip.Size());
	const FVector2D Dir = HorizDistCm > 1.f ? ToTip / HorizDistCm : FVector2D::ZeroVector;

	TwitchTimer = FMath::Max(0.f, TwitchTimer - DeltaTime);
	float TargetSpeed = ReelInput01 * Reel->GetMaxRetrieveSpeedMps();
	if (TwitchTimer > 0.f)
	{
		TargetSpeed += 1.2f; // рывок удилищем
	}
	LureSpeedMps = FMath::FInterpTo(LureSpeedMps, TargetSpeed, DeltaTime, 6.f);

	const float MoveCm = FMath::Min(LureSpeedMps * 100.f * DeltaTime, HorizDistCm);
	LurePos.X += Dir.X * MoveCm;
	LurePos.Y += Dir.Y * MoveCm;
	HorizDistCm -= MoveCm;

	// --- Глубина приманки ---
	BottomDepthM = Zone->GetDepthAt(LurePos);
	switch (Rod->Presentation)
	{
	case EBaitPresentation::Float:
	{
		const float Target = FMath::Min(FloatDepthM, BottomDepthM);
		LureDepthM = FMath::FInterpConstantTo(LureDepthM, Target, DeltaTime, 0.6f);
		break;
	}
	case EBaitPresentation::Bottom:
	{
		// Тяжёлый груз лежит на дне; при быстром подматывании оснастка отрывается
		const float Lift = FMath::Clamp(LureSpeedMps - 0.3f, 0.f, 2.f) * 1.5f;
		const float Target = FMath::Max(0.f, BottomDepthM - Lift);
		LureDepthM = FMath::FInterpConstantTo(LureDepthM, Target, DeltaTime, FMath::Max(0.8f, Bait->SinkRateMps));
		break;
	}
	case EBaitPresentation::Spinning:
	default:
	{
		if (Bait->LureType == ELureType::Wobbler && LureSpeedMps > 0.1f)
		{
			const float Target = FMath::Min(Bait->DiveDepthM * FMath::Clamp(LureSpeedMps / 0.8f, 0.3f, 1.2f), BottomDepthM);
			LureDepthM = FMath::FInterpConstantTo(LureDepthM, Target, DeltaTime, 0.8f);
		}
		else
		{
			// Блесна тонет, проводка поднимает её к поверхности
			const float VerticalSpeed = Bait->SinkRateMps - LureSpeedMps * 0.35f;
			LureDepthM = FMath::Clamp(LureDepthM + VerticalSpeed * DeltaTime, 0.f, BottomDepthM);
		}
		break;
	}
	}
	bLureOnBottom = LureDepthM >= BottomDepthM - 0.05f;

	// Поплавок на поверхности, остальное — на глубине
	const float VisualDepth = (Rod->Presentation == EBaitPresentation::Float) ? 0.f : LureDepthM;
	LurePos.Z = SurfaceZ - VisualDepth * 100.f;
	Lure->SetActorLocation(LurePos);

	const FVector BaitPos(LurePos.X, LurePos.Y, SurfaceZ - LureDepthM * 100.f);
	LineOutM = static_cast<float>(FVector::Dist(Tip, BaitPos)) / 100.f;

	// --- Снасть вытащена ---
	if (HorizDistCm / 100.f <= RetrieveFinishDistanceM || !Zone->ContainsXY(LurePos))
	{
		DestroyLure();
		SetState(EFishingState::Idle);
		return;
	}

	// --- Зацеп ---
	if (bLureOnBottom && LureSpeedMps > 0.1f && Zone->SnagChancePerSec > 0.f
		&& FMath::FRand() < Zone->SnagChancePerSec * DeltaTime)
	{
		LoseFish(EFishLoseReason::Snagged);
		return;
	}

	// --- Поклёвка ---
	BiteCooldown = FMath::Max(0.f, BiteCooldown - DeltaTime);
	BiteCheckTimer -= DeltaTime;
	if (BiteCheckTimer > 0.f)
	{
		return;
	}
	BiteCheckTimer = BiteCheckInterval;

	FBiteContext Ctx;
	if (!BuildBiteContext(Ctx))
	{
		return;
	}
	TArray<FBiteCandidate> Candidates;
	const float TotalScore = FFishBiteModel::GatherCandidates(Ctx, Candidates);
	const float Rate = FFishBiteModel::GetBiteRatePerSecond(Ctx, TotalScore);
	CachedBiteRatePerMin = Rate * 60.f;

	if (BiteCooldown <= 0.f && Candidates.Num() > 0)
	{
		const float Chance = 1.f - FMath::Exp(-Rate * BiteCheckInterval);
		if (FMath::FRand() < Chance)
		{
			if (const FBiteCandidate* Picked = FFishBiteModel::PickCandidate(Candidates, TotalScore))
			{
				StartBite(*Picked);
			}
		}
	}
}

bool UFishingComponent::BuildBiteContext(FBiteContext& OutContext) const
{
	if (!Loadout.IsComplete() || !CurrentZone.IsValid())
	{
		return false;
	}
	const UFishingProfileSubsystem* Profile = GetProfile();

	OutContext.Zone = CurrentZone.Get();
	OutContext.Env = UFishingWorldSubsystem::Get(this);
	OutContext.Catalog = Profile ? Profile->GetCatalog() : nullptr;
	OutContext.Rod = Loadout.Rod;
	OutContext.Line = Loadout.Line;
	OutContext.Hook = Loadout.Hook;
	OutContext.Bait = Loadout.Bait;
	OutContext.LureDepthM = LureDepthM;
	OutContext.BottomDepthM = BottomDepthM;
	OutContext.LureSpeedMps = LureSpeedMps;
	OutContext.bOnBottom = bLureOnBottom;
	OutContext.GlobalBiteRate = UFishingSettings::Get()->GlobalBiteRate;
	return true;
}

void UFishingComponent::StartBite(const FBiteCandidate& Candidate)
{
	UFishSpeciesData* Species = Candidate.Species;
	if (!Species)
	{
		return;
	}

	float Length = 0.f;
	float Weight = 0.f;
	bool bTrophy = false;
	FFishBiteModel::RollFishSize(*Species, Loadout.Bait, Candidate.SizeBias, Length, Weight, bTrophy);

	HookedFish = FHookedFish();
	HookedFish.Species = Species;
	HookedFish.LengthCm = Length;
	HookedFish.WeightKg = Weight;
	HookedFish.bTrophy = bTrophy;

	// Чувствительное удилище — поклёвку видно раньше, окно для подсечки длиннее
	BiteDuration = Species->BiteWindowSec * FMath::FRandRange(0.8f, 1.2f) * (0.75f + 0.5f * Loadout.Rod->Sensitivity);
	BiteTimer = 0.f;
	SetState(EFishingState::Bite);

	const float Strength = FMath::Clamp(Weight / FMath::Max(Species->WeightKg.Max, 0.1f), 0.2f, 1.f);
	if (Lure)
	{
		Lure->OnBiteVisual(Strength);
	}
	OnBite.Broadcast(Strength);

	// Хищник, атаковавший приманку в проводке, может засечься сам
	if (Loadout.Bait->IsArtificial() && LureSpeedMps > 0.1f)
	{
		const float SelfHook = Species->SelfHookChance * (0.5f + Loadout.Hook->Sharpness);
		if (FMath::FRand() < SelfHook)
		{
			ShowMessage(LOCTEXT("SelfHooked", "Рыба засеклась сама!"));
			HookFish(FMath::FRandRange(0.6f, 0.9f));
		}
	}
}

void UFishingComponent::TickBite(float DeltaTime)
{
	if (!Loadout.IsComplete())
	{
		LoseFish(EFishLoseReason::MissedStrike);
		return;
	}

	BiteTimer += DeltaTime;
	if (BiteTimer < BiteDuration)
	{
		return;
	}

	// Рыба бросила наживку
	const bool bStolen = !Loadout.Bait->IsArtificial() && FMath::FRand() < 0.4f;
	if (bStolen)
	{
		LoseFish(EFishLoseReason::BaitStolen);
		return;
	}
	ShowMessage(LOCTEXT("FishLeft", "Рыба бросила наживку"));
	BiteCooldown = 3.f;
	SetState(EFishingState::InWater);
}

void UFishingComponent::HookFish(float HookQuality)
{
	AFishingZone* Zone = CurrentZone.Get();
	const FVector Tip = GetRodTipLocation();
	const FVector LurePos = Lure ? Lure->GetActorLocation() : Tip;

	HookedFish.HookHold = FMath::Clamp(HookQuality, 0.2f, 1.f);
	HookedFish.BearingDeg = static_cast<float>((LurePos - Tip).Rotation().Yaw);

	const float HorizM = static_cast<float>(FVector::Dist2D(Tip, LurePos)) / 100.f;
	const float SurfaceZ = Zone ? Zone->GetWaterSurfaceZ() : static_cast<float>(LurePos.Z);
	const float TipHeightM = FMath::Max(0.2f, (static_cast<float>(Tip.Z) - SurfaceZ) / 100.f);
	const float Dist3D = FMath::Sqrt(FMath::Square(HorizM) + FMath::Square(TipHeightM + LureDepthM));

	Fight.Begin(HookedFish, Dist3D + 0.2f, HorizM, LureDepthM);
	LineOutM = Fight.LineOutM;

	if (Lure)
	{
		Lure->ShowHookedFish(HookedFish.Species, HookedFish.LengthCm);
		Lure->OnFishHookedVisual();
	}
	SetState(EFishingState::Fighting);
	OnFishHooked.Broadcast();
}

FFightTackle UFishingComponent::BuildFightTackle() const
{
	FFightTackle T;
	T.DragKg = FMath::Max(0.05f, Loadout.Reel->MaxDragKg * DragSetting01);
	T.LineBreakKg = Loadout.Line->BreakStrengthKg;
	T.KnotStrength = Loadout.Line->KnotStrength;
	T.LineStretchFraction = Loadout.Line->StretchPercent / 100.f;
	T.AbrasionResistance = Loadout.Line->AbrasionResistance;
	T.RodMaxLoadKg = Loadout.Rod->MaxLoadKg;
	T.RodFlexM = Loadout.Rod->FlexAtMaxLoadM;
	T.RodShockAbsorption = Loadout.Rod->ShockAbsorption;
	T.RodLengthM = Loadout.Rod->LengthM;
	T.MaxRetrieveSpeedMps = Loadout.Reel->GetMaxRetrieveSpeedMps();
	T.LineCapacityM = Loadout.Reel->LineCapacityM;
	T.DragSmoothness = Loadout.Reel->DragSmoothness;
	T.HookSharpness = Loadout.Hook->Sharpness;
	T.bBarbless = Loadout.Hook->bBarbless;
	T.bWireLeader = Loadout.Hook->bWireLeader;
	return T;
}

void UFishingComponent::TickFighting(float DeltaTime)
{
	AFishingZone* Zone = CurrentZone.Get();
	if (!Zone || !Lure || !Loadout.IsComplete() || !HookedFish.Species)
	{
		LoseFish(EFishLoseReason::HookSpat);
		return;
	}

	const FVector Tip = GetRodTipLocation();
	const float SurfaceZ = Zone->GetWaterSurfaceZ();

	auto FishWorldPos = [&]() -> FVector
	{
		const float BearingRad = FMath::DegreesToRadians(HookedFish.BearingDeg);
		return FVector(
			Tip.X + FMath::Cos(BearingRad) * HookedFish.DistanceM * 100.f,
			Tip.Y + FMath::Sin(BearingRad) * HookedFish.DistanceM * 100.f,
			SurfaceZ - HookedFish.DepthM * 100.f);
	};

	const FVector FishPosBefore = FishWorldPos();

	FFightEnvironment Env;
	// Рыба ушла за пределы зоны — там мелководье
	Env.BottomDepthM = Zone->ContainsXY(FishPosBefore) ? Zone->GetDepthAt(FishPosBefore) : 0.4f;
	Env.Bottom = Zone->BottomType;
	Env.LandingDistanceM = LandingDistanceM;
	Env.RodTipHeightM = FMath::Max(0.2f, (static_cast<float>(Tip.Z) - SurfaceZ) / 100.f);

	FFightInput Input;
	Input.Reel01 = ReelInput01;
	Input.RodLift01 = RodLift01;

	const FFightStepResult Result = Fight.Step(HookedFish, BuildFightTackle(), Input, Env, DeltaTime);
	TensionKg = Result.TensionKg;
	bDragSlipping = Result.bDragSlipping;
	LineOutM = Fight.LineOutM;

	Lure->SetActorLocation(FishWorldPos());
	Lure->SetActorRotation(FRotator(0.f, HookedFish.BearingDeg + HookedFish.SwimAngleDeg, 0.f));
	if (Result.bJumped)
	{
		Lure->OnFishJumpVisual();
	}

	if (Result.LoseReason != EFishLoseReason::None)
	{
		LoseFish(Result.LoseReason);
		return;
	}
	if (Result.bLanded)
	{
		LandFish();
	}
}

void UFishingComponent::LandFish()
{
	UFishingProfileSubsystem* Profile = GetProfile();
	const UFishingWorldSubsystem* WorldSub = UFishingWorldSubsystem::Get(this);

	PendingCatch = FCatchRecord();
	PendingCatch.SpeciesId = HookedFish.Species ? HookedFish.Species->SpeciesId : NAME_None;
	PendingCatch.WeightKg = HookedFish.WeightKg;
	PendingCatch.LengthCm = HookedFish.LengthCm;
	PendingCatch.bTrophy = HookedFish.bTrophy;
	PendingCatch.BaitId = Loadout.Bait ? Loadout.Bait->ItemId : NAME_None;
	PendingCatch.RodId = Loadout.Rod ? Loadout.Rod->ItemId : NAME_None;
	PendingCatch.ZoneName = CurrentZone.IsValid() ? CurrentZone->ZoneName.ToString() : FString();
	PendingCatch.GameHour = WorldSub ? WorldSub->TimeOfDayHours : 0.f;
	PendingCatch.CaughtAt = FDateTime::Now();
	if (Profile)
	{
		Profile->FillCatchValue(PendingCatch);
	}

	ReelInput01 = 0.f;
	TensionKg = 0.f;
	SetState(EFishingState::Landed);
	OnFishLanded.Broadcast(PendingCatch);
}

void UFishingComponent::ConfirmCatch(bool bKeepInNet)
{
	if (FishingState != EFishingState::Landed)
	{
		return;
	}

	if (UFishingProfileSubsystem* Profile = GetProfile())
	{
		Profile->RegisterCatch(PendingCatch, bKeepInNet);
		if (Loadout.Bait && Loadout.Bait->bConsumedOnCatch)
		{
			Profile->ConsumeItem(Loadout.Bait->ItemId, 1);
		}
	}
	if (AFishingZone* Zone = CurrentZone.Get())
	{
		Zone->AddFishingPressure(bKeepInNet ? Zone->PressurePerCatch : Zone->PressurePerCatch * 0.5f);
	}

	ShowMessage(bKeepInNet
		? LOCTEXT("KeptFish", "Рыба отправлена в садок")
		: LOCTEXT("ReleasedFish", "Рыба отпущена — бонус к опыту"));

	DestroyLure();
	SetState(EFishingState::Idle);
}

void UFishingComponent::LoseFish(EFishLoseReason Reason)
{
	LastLoseReason = Reason;
	UFishingProfileSubsystem* Profile = GetProfile();

	if (Profile && Loadout.IsComplete())
	{
		switch (Reason)
		{
		case EFishLoseReason::LineBroke:
		case EFishLoseReason::BiteOff:
		case EFishLoseReason::Snagged:
		case EFishLoseReason::Spooled:
			// Оснастка ушла вместе с рыбой / осталась в коряге
			if (Loadout.Hook->bLostOnBreak)
			{
				Profile->ConsumeItem(Loadout.Hook->ItemId, 1);
			}
			if (Loadout.Bait->bLostOnBreak || Loadout.Bait->bConsumedOnCatch)
			{
				Profile->ConsumeItem(Loadout.Bait->ItemId, 1);
			}
			break;
		case EFishLoseReason::BaitStolen:
			Profile->ConsumeItem(Loadout.Bait->ItemId, 1);
			break;
		case EFishLoseReason::RodBroke:
			Profile->MarkItemBroken(Loadout.Rod->ItemId);
			break;
		default:
			break;
		}
	}

	const bool bTackleGone = Reason == EFishLoseReason::LineBroke || Reason == EFishLoseReason::BiteOff
		|| Reason == EFishLoseReason::Snagged || Reason == EFishLoseReason::Spooled;
	if (bTackleGone)
	{
		DestroyLure();
	}
	else if (Lure)
	{
		Lure->HideFish();
	}

	ReelInput01 = 0.f;
	TensionKg = 0.f;
	ShowMessage(GetLoseReasonText(Reason));
	SetState(EFishingState::Lost);
	OnFishLost.Broadcast(Reason);
}

void UFishingComponent::TickLost(float DeltaTime)
{
	if (StateTimer >= LostResetDelay)
	{
		DestroyLure();
		SetState(EFishingState::Idle);
	}
}

// ============================================================================
// Управление
// ============================================================================

void UFishingComponent::BeginCast()
{
	if (FishingState != EFishingState::Idle)
	{
		return;
	}

	FText Reason;
	if (!Loadout.IsCompatible(Reason))
	{
		ShowMessage(Reason);
		return;
	}
	if (const UFishingProfileSubsystem* Profile = GetProfile())
	{
		if (Profile->GetItemCount(Loadout.Bait->ItemId) <= 0)
		{
			ShowMessage(LOCTEXT("NoBait", "Закончилась наживка — купи в магазине"));
			return;
		}
		if (Profile->GetItemCount(Loadout.Hook->ItemId) <= 0)
		{
			ShowMessage(LOCTEXT("NoHooks", "Закончились крючки — купи в магазине"));
			return;
		}
	}

	CastCharge = 0.f;
	SetState(EFishingState::ChargingCast);
}

void UFishingComponent::ReleaseCast()
{
	if (FishingState != EFishingState::ChargingCast)
	{
		return;
	}

	UWorld* MyWorld = GetWorld();
	AActor* MyOwner = GetOwner();
	if (!MyWorld || !MyOwner || !Loadout.IsComplete() || !LureClass)
	{
		SetState(EFishingState::Idle);
		return;
	}

	FRotator Aim = MyOwner->GetActorRotation();
	if (const APawn* Pawn = Cast<APawn>(MyOwner))
	{
		Aim = Pawn->GetControlRotation();
	}
	Aim.Pitch = CastPitchDeg;
	Aim.Roll = 0.f;

	// Вес оснастки: у приманки — её вес, у натуральной наживки — груз/кормушка под тест удилища
	const float CastWeightG = Loadout.Bait->IsArtificial()
		? Loadout.Bait->WeightG
		: (Loadout.Rod->CastWeightG.Min + Loadout.Rod->CastWeightG.Max) * 0.5f;
	const float WeightFactor = Loadout.Rod->GetCastWeightFactor(CastWeightG);
	const float Power = FMath::Max(0.08f, CastCharge);
	const float Speed = MaxCastSpeed * Power * Loadout.Rod->CastDistanceFactor * WeightFactor;

	FActorSpawnParameters SpawnParams;
	SpawnParams.Owner = MyOwner;
	SpawnParams.Instigator = Cast<APawn>(MyOwner);
	SpawnParams.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;

	Lure = MyWorld->SpawnActor<AFishingLureActor>(LureClass, GetRodTipLocation(), Aim, SpawnParams);
	if (!Lure)
	{
		SetState(EFishingState::Idle);
		return;
	}

	Lure->SetupVisuals(Loadout.Bait, Loadout.Rod->Presentation == EBaitPresentation::Float);
	Lure->OnLanded.AddUObject(this, &UFishingComponent::HandleLureLanded);

	// Лёгкие приманки сильнее тормозятся воздухом
	const float AirDrag = FMath::Clamp(0.5f / FMath::Max(CastWeightG, 0.5f), 0.02f, 0.8f);
	Lure->Launch(Aim.Vector() * Speed, AirDrag);

	LineOutM = 0.f;
	SetState(EFishingState::LureFlying);
}

void UFishingComponent::HandleLureLanded(bool bInWater, AFishingZone* Zone)
{
	if (FishingState != EFishingState::LureFlying)
	{
		return;
	}

	if (!bInWater || !Zone || !Lure)
	{
		LastLoseReason = EFishLoseReason::CastFailed;
		ShowMessage(GetLoseReasonText(EFishLoseReason::CastFailed));
		DestroyLure();
		SetState(EFishingState::Idle);
		return;
	}

	CurrentZone = Zone;
	LureDepthM = 0.f;
	LureSpeedMps = 0.f;
	bLureOnBottom = false;
	BottomDepthM = Zone->GetDepthAt(Lure->GetActorLocation());
	LineOutM = static_cast<float>(FVector::Dist(GetRodTipLocation(), Lure->GetActorLocation())) / 100.f;
	BiteCheckTimer = BiteCheckInterval;
	// Всплеск пугает рыбу: чем тяжелее приманка, тем дольше
	BiteCooldown = 1.5f + Loadout.Bait->WeightG / 15.f;
	SetState(EFishingState::InWater);
}

void UFishingComponent::SetReelInput(float Value01)
{
	ReelInput01 = FMath::Clamp(Value01, 0.f, 1.f);
}

void UFishingComponent::SetRodLift(float Value01)
{
	RodLift01 = FMath::Clamp(Value01, 0.f, 1.f);
}

void UFishingComponent::AdjustDrag(float Delta01)
{
	SetDrag01(DragSetting01 + Delta01);
}

void UFishingComponent::SetDrag01(float Value01)
{
	DragSetting01 = FMath::Clamp(Value01, 0.02f, 1.f);
}

void UFishingComponent::SetFloatDepth(float InDepthM)
{
	FloatDepthM = FMath::Clamp(InDepthM, 0.2f, 15.f);
}

void UFishingComponent::Strike()
{
	switch (FishingState)
	{
	case EFishingState::Bite:
	{
		// Тайминг: слишком рано — вырвешь наживку изо рта, слишком поздно — рыба насторожилась
		const float Phase = BiteDuration > 0.f ? BiteTimer / BiteDuration : 1.f;
		float Timing = 1.f;
		if (Phase < 0.15f)
		{
			Timing = 0.55f;
		}
		else if (Phase > 0.8f)
		{
			Timing = 0.7f;
		}

		float Chance = (0.45f + 0.35f * Loadout.Hook->Sharpness + 0.15f * Loadout.Rod->Sensitivity) * Timing;
		if (HookedFish.Species && !HookedFish.Species->IsHookSuitable(Loadout.Hook->HookSize))
		{
			Chance *= 0.6f;
		}
		Chance = FMath::Clamp(Chance, 0.05f, 0.97f);

		if (FMath::FRand() < Chance)
		{
			HookFish(0.45f + 0.4f * Timing * Loadout.Hook->Sharpness + FMath::FRandRange(0.f, 0.2f));
		}
		else
		{
			ShowMessage(GetLoseReasonText(EFishLoseReason::MissedStrike));
			BiteCooldown = 4.f;
			TwitchTimer = 0.2f;
			SetState(EFishingState::InWater);
		}
		break;
	}
	case EFishingState::InWater:
		if (Loadout.Rod && Loadout.Rod->Presentation == EBaitPresentation::Spinning)
		{
			TwitchTimer = 0.25f; // рывок оживляет приманку
		}
		else
		{
			TwitchTimer = 0.1f;
			BiteCooldown = FMath::Max(BiteCooldown, 2.f); // дёрнул поплавок — рыба насторожилась
		}
		break;
	default:
		break;
	}
}

void UFishingComponent::CancelAndReelIn()
{
	switch (FishingState)
	{
	case EFishingState::ChargingCast:
	case EFishingState::LureFlying:
	case EFishingState::InWater:
	case EFishingState::Bite:
		DestroyLure();
		SetState(EFishingState::Idle);
		break;
	default:
		break;
	}
}

// ============================================================================
// Снасть
// ============================================================================

bool UFishingComponent::SetLoadout(const FTackleLoadout& NewLoadout)
{
	if (FishingState != EFishingState::Idle)
	{
		ShowMessage(LOCTEXT("CantChangeTackle", "Сначала смотай снасть"));
		return false;
	}
	Loadout = NewLoadout;
	bLoadoutDirty = false;
	OnLoadoutChanged.Broadcast();
	return true;
}

void UFishingComponent::RefreshLoadoutFromProfile()
{
	if (FishingState != EFishingState::Idle)
	{
		bLoadoutDirty = true;
		return;
	}
	if (const UFishingProfileSubsystem* Profile = GetProfile())
	{
		Loadout = Profile->BuildEquippedLoadout();
		bLoadoutDirty = false;
		OnLoadoutChanged.Broadcast();
	}
}

void UFishingComponent::HandleProfileLoadoutChanged()
{
	RefreshLoadoutFromProfile();
}

void UFishingComponent::ApplyPendingLoadout()
{
	if (bLoadoutDirty)
	{
		RefreshLoadoutFromProfile();
	}
}

void UFishingComponent::SetRodTip(USceneComponent* TipComponent, FName TipSocket)
{
	RodTipComponent = TipComponent;
	RodTipSocketName = TipSocket;
}

FVector UFishingComponent::GetRodTipLocation() const
{
	if (const USceneComponent* Tip = RodTipComponent.Get())
	{
		return Tip->GetSocketLocation(RodTipSocketName);
	}
	const AActor* MyOwner = GetOwner();
	if (!MyOwner)
	{
		return FVector::ZeroVector;
	}
	const float RodLength = Loadout.Rod ? Loadout.Rod->LengthM : 2.5f;
	return MyOwner->GetActorLocation() + MyOwner->GetActorForwardVector() * RodLength * 80.f + FVector(0.f, 0.f, 120.f);
}

void UFishingComponent::DestroyLure()
{
	if (Lure)
	{
		Lure->OnLanded.RemoveAll(this);
		Lure->Destroy();
		Lure = nullptr;
	}
}

// ============================================================================
// UI-хелперы
// ============================================================================

float UFishingComponent::GetWeakestLinkKg() const
{
	if (!Loadout.Line || !Loadout.Rod)
	{
		return 1.f;
	}
	const float LineStrength = Loadout.Line->BreakStrengthKg * Loadout.Line->KnotStrength * (1.f - 0.6f * Fight.LineWear);
	return FMath::Max(0.1f, FMath::Min(LineStrength, Loadout.Rod->MaxLoadKg));
}

float UFishingComponent::GetTension01() const
{
	return TensionKg / GetWeakestLinkKg();
}

float UFishingComponent::GetDragKg() const
{
	return Loadout.Reel ? Loadout.Reel->MaxDragKg * DragSetting01 : 0.f;
}

float UFishingComponent::GetDragMark01() const
{
	return GetDragKg() / GetWeakestLinkKg();
}

float UFishingComponent::GetLastMessageAge() const
{
	const UWorld* MyWorld = GetWorld();
	return MyWorld ? MyWorld->GetTimeSeconds() - LastMessageTime : 1000.f;
}

void UFishingComponent::ShowMessage(const FText& Text)
{
	LastMessage = Text;
	if (const UWorld* MyWorld = GetWorld())
	{
		LastMessageTime = MyWorld->GetTimeSeconds();
	}
	UE_LOG(LogFishing, Log, TEXT("%s"), *Text.ToString());
	OnMessage.Broadcast(Text);
}

FText UFishingComponent::GetLoseReasonText(EFishLoseReason Reason)
{
	switch (Reason)
	{
	case EFishLoseReason::LineBroke:	return LOCTEXT("LoseLineBroke", "Обрыв лески! Ослабь фрикцион.");
	case EFishLoseReason::RodBroke:		return LOCTEXT("LoseRodBroke", "Удилище сломано! Почини его в магазине.");
	case EFishLoseReason::HookSpat:		return LOCTEXT("LoseHookSpat", "Сход! Не давай слабину.");
	case EFishLoseReason::Spooled:		return LOCTEXT("LoseSpooled", "Рыба смотала всю леску!");
	case EFishLoseReason::BiteOff:		return LOCTEXT("LoseBiteOff", "Перекус! Нужен металлический поводок.");
	case EFishLoseReason::Snagged:		return LOCTEXT("LoseSnagged", "Зацеп! Оснастка потеряна.");
	case EFishLoseReason::MissedStrike:	return LOCTEXT("LoseMissed", "Пустая подсечка.");
	case EFishLoseReason::BaitStolen:	return LOCTEXT("LoseBaitStolen", "Рыба объела наживку.");
	case EFishLoseReason::CastFailed:	return LOCTEXT("LoseCastFailed", "Заброс мимо воды.");
	default:							return FText::GetEmpty();
	}
}

void UFishingComponent::DrawDebugTackle() const
{
#if ENABLE_DRAW_DEBUG
	if (!bDrawDebugLine || !Lure)
	{
		return;
	}
	const UWorld* MyWorld = GetWorld();
	const FVector Tip = GetRodTipLocation();
	const FVector LurePos = Lure->GetActorLocation();
	const float T01 = FMath::Clamp(GetTension01(), 0.f, 1.f);
	const FColor Color = FLinearColor::LerpUsingHSV(FLinearColor::Green, FLinearColor::Red, T01).ToFColor(true);
	DrawDebugLine(MyWorld, Tip, LurePos, Color, false, -1.f, 0, 0.6f);

	// Поплавочная снасть: леска от поплавка вниз до наживки
	if (FishingState != EFishingState::Fighting && Loadout.Rod && Loadout.Rod->Presentation == EBaitPresentation::Float)
	{
		DrawDebugLine(MyWorld, LurePos, LurePos - FVector(0.f, 0.f, LureDepthM * 100.f), FColor::White, false, -1.f, 0, 0.3f);
	}
#endif
}

#undef LOCTEXT_NAMESPACE
