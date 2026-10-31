#include "Fishing/FishFightSimulator.h"
#include "Data/FishSpeciesData.h"

static constexpr float GravityMps2 = 9.81f;

void FFishFightSimulator::Begin(FHookedFish& Fish, float InLineOutM, float InDistanceM, float InDepthM)
{
	Fish.Stamina = 1.f;
	Fish.DistanceM = FMath::Max(0.5f, InDistanceM);
	Fish.DepthM = FMath::Max(0.f, InDepthM);
	Fish.TargetDepthM = Fish.DepthM;
	Fish.RadialSpeed = 0.f;
	Fish.Phase = EFishFightPhase::Run;
	Fish.PhaseTimer = FMath::FRandRange(1.f, 2.5f);
	Fish.SwimAngleDeg = FMath::FRandRange(-40.f, 40.f);
	Fish.bJumpDone = false;

	LineOutM = FMath::Max(InLineOutM, 0.5f);
	TensionKg = 0.f;
	LineWear = 0.f;
	RodLiftM = 0.f;
	FightTime = 0.f;
	PrevStretch = 0.f;
	LineOverload = 0.f;
	RodOverload = 0.f;
	SlackTime = 0.f;
	ShakeClock = 0.f;
	bWasSlipping = false;
}

void FFishFightSimulator::GetPhaseParams(EFishFightPhase Phase, float& OutPullMul, float& OutSpeedMul)
{
	switch (Phase)
	{
	case EFishFightPhase::Run:			OutPullMul = 1.0f;	OutSpeedMul = 1.0f;	break;
	case EFishFightPhase::Hold:			OutPullMul = 0.7f;	OutSpeedMul = 0.3f;	break;
	case EFishFightPhase::HeadShake:	OutPullMul = 0.6f;	OutSpeedMul = 0.15f; break;
	case EFishFightPhase::Jump:			OutPullMul = 0.9f;	OutSpeedMul = 0.6f;	break;
	case EFishFightPhase::Tired:		OutPullMul = 0.12f;	OutSpeedMul = 0.2f;	break;
	default:							OutPullMul = 0.5f;	OutSpeedMul = 0.5f;	break;
	}
}

void FFishFightSimulator::UpdatePhase(FHookedFish& Fish, const FFightEnvironment& Env, float DeltaTime)
{
	Fish.PhaseTimer -= DeltaTime;
	if (Fish.PhaseTimer > 0.f)
	{
		return;
	}

	const UFishSpeciesData* S = Fish.Species;
	const float St = Fish.Stamina;
	const bool bNearShore = Fish.DistanceM < Env.LandingDistanceM * 2.5f;

	// Веса фаз: свежая рыба рвётся и упирается, уставшая — подходит; у берега последний рывок
	const float WRun = S->Aggression * St * 2.f + (bNearShore ? St * 1.5f : 0.f);
	const float WHold = (S->bSeeksCover ? 1.2f : 0.4f) * St;
	const float WShake = S->HeadShakeChance * (0.5f + St);
	const float WJump = Fish.DepthM < 2.5f ? S->JumpChance * 5.f * St : 0.f;
	const float WTired = (1.f - St) * 2.f + 0.15f;

	float Roll = FMath::FRand() * (WRun + WHold + WShake + WJump + WTired);
	EFishFightPhase NewPhase = EFishFightPhase::Tired;
	if ((Roll -= WRun) < 0.f)			{ NewPhase = EFishFightPhase::Run; }
	else if ((Roll -= WHold) < 0.f)		{ NewPhase = EFishFightPhase::Hold; }
	else if ((Roll -= WShake) < 0.f)	{ NewPhase = EFishFightPhase::HeadShake; }
	else if ((Roll -= WJump) < 0.f)		{ NewPhase = EFishFightPhase::Jump; }

	Fish.Phase = NewPhase;
	Fish.bJumpDone = false;
	const float Bottom = FMath::Max(0.3f, Env.BottomDepthM);
	const float Side = FMath::RandBool() ? 1.f : -1.f;

	switch (NewPhase)
	{
	case EFishFightPhase::Run:
		Fish.PhaseTimer = FMath::FRandRange(1.5f, 4.f);
		Fish.SwimAngleDeg = FMath::FRandRange(-60.f, 60.f);
		Fish.TargetDepthM = FMath::Clamp(Fish.DepthM + FMath::FRandRange(-1.f, 1.5f), 0.3f, Bottom);
		break;
	case EFishFightPhase::Hold:
		Fish.PhaseTimer = FMath::FRandRange(2.f, 5.f);
		Fish.SwimAngleDeg = Side * FMath::FRandRange(50.f, 110.f);
		Fish.TargetDepthM = Bottom;
		break;
	case EFishFightPhase::HeadShake:
		Fish.PhaseTimer = FMath::FRandRange(0.8f, 2.f);
		Fish.TargetDepthM = Fish.DepthM;
		break;
	case EFishFightPhase::Jump:
		Fish.PhaseTimer = FMath::FRandRange(0.8f, 1.4f);
		Fish.TargetDepthM = 0.f;
		break;
	case EFishFightPhase::Tired:
	default:
		Fish.PhaseTimer = FMath::FRandRange(2.f, 4.f);
		Fish.SwimAngleDeg = FMath::FRandRange(150.f, 210.f); // дрейфует к рыбаку — выбирай слабину!
		Fish.TargetDepthM = 0.3f;
		break;
	}
}

FFightStepResult FFishFightSimulator::Step(FHookedFish& Fish, const FFightTackle& T, const FFightInput& In,
	const FFightEnvironment& Env, float DeltaTime)
{
	FFightStepResult Result;
	const UFishSpeciesData* S = Fish.Species;
	if (!S || DeltaTime <= 0.f)
	{
		Result.TensionKg = TensionKg;
		return Result;
	}

	FightTime += DeltaTime;
	ShakeClock += DeltaTime;
	UpdatePhase(Fish, Env, DeltaTime);

	float PullMul = 1.f;
	float SpeedMul = 1.f;
	GetPhaseParams(Fish.Phase, PullMul, SpeedMul);

	const float MaxPull = FMath::Max(0.02f, Fish.WeightKg * S->PullFactor);
	const float Energy = 0.2f + 0.8f * Fish.Stamina;

	float Thrust = MaxPull * PullMul * Energy;
	if (Fish.Phase == EFishFightPhase::HeadShake)
	{
		Thrust *= 0.5f + 0.8f * FMath::Abs(FMath::Sin(ShakeClock * 14.f));
	}

	const float AngleRad = FMath::DegreesToRadians(Fish.SwimAngleDeg);
	const float RadialThrust = Thrust * FMath::Cos(AngleRad);
	const float LateralSpeed = S->BurstSpeedMps * SpeedMul * Energy * FMath::Sin(AngleRad);

	// Масса рыбы с присоединённой массой воды, в единицах кгс*с^2/м
	const float Mass = FMath::Max(0.01f, Fish.WeightKg) * 1.4f / GravityMps2;
	// Сопротивление воды подобрано так, чтобы при полной тяге рыба шла со скоростью BurstSpeed
	const float WaterDragCoef = MaxPull / FMath::Square(FMath::Max(0.3f, S->BurstSpeedMps));

	// Подкачка: поднятое удилище «укорачивает» леску на часть своей длины
	const float LiftTarget = FMath::Clamp(In.RodLift01, 0.f, 1.f) * T.RodLengthM * 0.6f;
	RodLiftM = FMath::FInterpConstantTo(RodLiftM, LiftTarget, DeltaTime, 1.2f);

	const int32 NumSub = FMath::Clamp(FMath::CeilToInt(DeltaTime / 0.004f), 1, 20);
	const float H = DeltaTime / NumSub;

	float MaxT = 0.f;
	float SumT = 0.f;
	bool bSlipAny = false;

	for (int32 Sub = 0; Sub < NumSub; ++Sub)
	{
		const float Vert = Env.RodTipHeightM + Fish.DepthM;
		const float Dist3D = FMath::Sqrt(FMath::Square(Fish.DistanceM) + FMath::Square(Vert));
		const float EffLine = FMath::Max(0.3f, LineOutM - RodLiftM);

		// Жёсткость системы «удилище + леска» (последовательные пружины)
		const float KRod = T.RodMaxLoadKg / FMath::Max(0.05f, T.RodFlexM);
		const float KLine = T.LineBreakKg / FMath::Max(0.01f, EffLine * T.LineStretchFraction);
		const float K = 1.f / (1.f / KRod + 1.f / KLine);
		const float Zeta = FMath::Lerp(0.3f, 1.f, T.RodShockAbsorption);
		const float Damp = 2.f * Zeta * FMath::Sqrt(K * Mass);

		const float Stretch = Dist3D - EffLine;
		const float StretchRate = (Stretch - PrevStretch) / H;
		PrevStretch = Stretch;

		float Ten = 0.f;
		if (Stretch > 0.f)
		{
			Ten = FMath::Max(0.f, K * Stretch + Damp * StretchRate);
		}

		// Фрикцион: страгивание тяжелее, чем скольжение
		const float BreakAway = bWasSlipping ? T.DragKg : T.DragKg * (1.f + (1.f - T.DragSmoothness) * 0.3f);
		bool bSlip = false;
		if (Ten > BreakAway)
		{
			const float Give = (Ten - T.DragKg) / K;
			LineOutM += Give;
			PrevStretch -= Give;
			Ten = T.DragKg;
			bSlip = true;
		}
		else if (In.Reel01 > 0.01f)
		{
			// Катушка выбирает леску, пока фрикцион не проскальзывает
			LineOutM = FMath::Max(0.5f, LineOutM - In.Reel01 * T.MaxRetrieveSpeedMps * H);
		}
		bWasSlipping = bSlip;
		bSlipAny |= bSlip;

		// Радиальная динамика рыбы (+ = от рыбака)
		const float HorizFrac = Dist3D > UE_KINDA_SMALL_NUMBER ? Fish.DistanceM / Dist3D : 1.f;
		const float WaterDrag = WaterDragCoef * Fish.RadialSpeed * FMath::Abs(Fish.RadialSpeed);
		const float Force = RadialThrust - Ten * HorizFrac - WaterDrag;
		Fish.RadialSpeed += Force / Mass * H;
		Fish.DistanceM += Fish.RadialSpeed * H;
		if (Fish.DistanceM < 0.3f)
		{
			Fish.DistanceM = 0.3f;
			Fish.RadialSpeed = FMath::Max(0.f, Fish.RadialSpeed);
		}

		// Вертикальная составляющая натяжения поднимает рыбу к поверхности
		const float VertFrac = Dist3D > UE_KINDA_SMALL_NUMBER ? Vert / Dist3D : 0.f;
		Fish.DepthM -= (Ten * VertFrac / FMath::Max(MaxPull, 0.05f)) * 0.25f * H;

		MaxT = FMath::Max(MaxT, Ten);
		SumT += Ten;
	}

	const float AvgT = SumT / NumSub;
	TensionKg = AvgT;
	Result.TensionKg = AvgT;
	Result.bDragSlipping = bSlipAny;

	// Боковое движение рыбы
	Fish.BearingDeg += FMath::RadiansToDegrees(LateralSpeed * DeltaTime / FMath::Max(Fish.DistanceM, 1.f));

	// Глубина
	const float Bottom = FMath::Max(0.2f, Env.BottomDepthM);
	Fish.DepthM = FMath::FInterpConstantTo(Fish.DepthM, Fish.TargetDepthM, DeltaTime, 0.6f * Energy + 0.1f);
	Fish.DepthM = FMath::Clamp(Fish.DepthM, 0.f, Bottom);

	// Свечка: на слабой леске рыба легко выплёвывает крючок
	if (Fish.Phase == EFishFightPhase::Jump && !Fish.bJumpDone && Fish.DepthM < 0.4f)
	{
		Fish.bJumpDone = true;
		Result.bJumped = true;
		if (AvgT < 0.15f * MaxPull)
		{
			Fish.HookHold -= (T.bBarbless ? 0.6f : 0.35f) / FMath::Max(0.3f, S->MouthToughness);
		}
	}

	// Выносливость
	const float Endurance = FMath::Max(3.f, S->EnduranceSec * FMath::Pow(FMath::Max(Fish.WeightKg, 0.05f), 0.35f));
	const float Effort = 0.65f * FMath::Clamp(AvgT / MaxPull, 0.f, 1.5f) + 0.35f * PullMul;
	Fish.Stamina -= Effort * DeltaTime / Endurance;
	if (AvgT < 0.05f * MaxPull && Fish.Phase != EFishFightPhase::Run)
	{
		Fish.Stamina += 0.015f * DeltaTime; // отдыхает, если леска ослаблена
	}
	Fish.Stamina = FMath::Clamp(Fish.Stamina, 0.f, 1.f);

	// ------------------- Потери -------------------

	// Слабина -> крючок выпадает
	if (AvgT < 0.04f * MaxPull + 0.02f)
	{
		SlackTime += DeltaTime;
	}
	else
	{
		SlackTime = FMath::Max(0.f, SlackTime - 2.f * DeltaTime);
	}
	if (SlackTime > 0.8f)
	{
		float Rate = 0.35f;
		if (Fish.Phase == EFishFightPhase::HeadShake || Fish.Phase == EFishFightPhase::Jump)
		{
			Rate *= 2.5f;
		}
		if (T.bBarbless)
		{
			Rate *= 2.f;
		}
		Fish.HookHold -= Rate * DeltaTime / FMath::Max(0.3f, S->MouthToughness);
	}

	// Слишком сильное натяжение рвёт мягкую губу
	const float TearLimit = (Fish.WeightKg * 2.5f + 1.f) * S->MouthToughness * (0.7f + 0.6f * T.HookSharpness);
	if (MaxT > TearLimit)
	{
		Fish.HookHold -= (MaxT / TearLimit - 1.f) * 1.5f * DeltaTime;
	}

	if (Fish.HookHold <= 0.f)
	{
		Result.LoseReason = EFishLoseReason::HookSpat;
		return Result;
	}

	// Перекус без металлического поводка
	if (!T.bWireLeader && S->TeethCutChance > 0.f && Fish.Phase == EFishFightPhase::HeadShake
		&& FMath::FRand() < S->TeethCutChance * DeltaTime)
	{
		Result.LoseReason = EFishLoseReason::BiteOff;
		return Result;
	}

	// Перетирание о камни/коряги и уход в коряжник
	const bool bNearBottom = Fish.DepthM >= Bottom - 0.4f;
	if (bNearBottom && (Env.Bottom == EBottomType::Rock || Env.Bottom == EBottomType::Snags))
	{
		LineWear += DeltaTime * 0.06f * (1.f - T.AbrasionResistance) * (0.3f + AvgT / T.LineBreakKg);
	}
	if (bNearBottom && Env.Bottom == EBottomType::Snags && S->bSeeksCover && Fish.Phase == EFishFightPhase::Hold)
	{
		const float EscapeChance = 0.12f * FMath::Clamp(1.f - AvgT / MaxPull, 0.f, 1.f);
		if (FMath::FRand() < EscapeChance * DeltaTime)
		{
			Result.LoseReason = EFishLoseReason::Snagged;
			return Result;
		}
	}

	// Обрыв лески (короткие пики прощаются, длительный перегруз — нет)
	const float LineStrength = T.LineBreakKg * T.KnotStrength * (1.f - 0.6f * FMath::Clamp(LineWear, 0.f, 1.f));
	if (MaxT > LineStrength)
	{
		LineOverload += DeltaTime * (1.f + 8.f * (MaxT - LineStrength) / LineStrength);
	}
	else
	{
		LineOverload = FMath::Max(0.f, LineOverload - DeltaTime);
	}
	if (LineOverload > 0.12f || MaxT > LineStrength * 1.3f)
	{
		Result.LoseReason = EFishLoseReason::LineBroke;
		return Result;
	}

	// Поломка удилища (при высоко поднятом удилище нагрузка больше)
	const float RodLoad = MaxT * (1.f + 0.35f * In.RodLift01);
	if (RodLoad > T.RodMaxLoadKg)
	{
		RodOverload += DeltaTime;
	}
	else
	{
		RodOverload = FMath::Max(0.f, RodOverload - DeltaTime);
	}
	if (RodOverload > 0.4f)
	{
		Result.LoseReason = EFishLoseReason::RodBroke;
		return Result;
	}

	// Рыба смотала всю леску
	if (LineOutM >= T.LineCapacityM)
	{
		Result.LoseReason = EFishLoseReason::Spooled;
		return Result;
	}

	// Подсачек: рыба рядом, у поверхности и устала (мелочь — сразу)
	if (Fish.DistanceM <= Env.LandingDistanceM && Fish.DepthM < 1.2f)
	{
		if (Fish.Stamina < 0.3f || Fish.WeightKg < 0.4f)
		{
			Result.bLanded = true;
		}
		else if (Fish.Phase == EFishFightPhase::Tired)
		{
			Fish.PhaseTimer = 0.f; // увидела берег — сейчас рванёт
		}
	}

	return Result;
}
