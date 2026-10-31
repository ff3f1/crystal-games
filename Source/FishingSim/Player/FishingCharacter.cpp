#include "Player/FishingCharacter.h"
#include "Fishing/FishingComponent.h"
#include "Economy/FishingProfileSubsystem.h"
#include "Data/TackleData.h"
#include "FishingSim.h"
#include "Camera/CameraComponent.h"
#include "Components/CapsuleComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Engine/LocalPlayer.h"
#include "Engine/StaticMesh.h"
#include "EnhancedInputComponent.h"
#include "EnhancedInputSubsystems.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "GameFramework/PlayerController.h"
#include "GameFramework/SpringArmComponent.h"
#include "InputAction.h"
#include "InputMappingContext.h"
#include "InputModifiers.h"

#define LOCTEXT_NAMESPACE "FishingCharacter"

AFishingCharacter::AFishingCharacter()
{
	GetCapsuleComponent()->InitCapsuleSize(42.f, 96.f);

	// Персонаж смотрит туда же, куда камера — так удобнее целиться при забросе
	bUseControllerRotationYaw = true;
	bUseControllerRotationPitch = false;
	bUseControllerRotationRoll = false;
	GetCharacterMovement()->bOrientRotationToMovement = false;
	GetCharacterMovement()->MaxWalkSpeed = 350.f;

	CameraBoom = CreateDefaultSubobject<USpringArmComponent>(TEXT("CameraBoom"));
	CameraBoom->SetupAttachment(RootComponent);
	CameraBoom->TargetArmLength = 380.f;
	CameraBoom->SocketOffset = FVector(0.f, 60.f, 80.f);
	CameraBoom->bUsePawnControlRotation = true;

	FollowCamera = CreateDefaultSubobject<UCameraComponent>(TEXT("FollowCamera"));
	FollowCamera->SetupAttachment(CameraBoom, USpringArmComponent::SocketName);
	FollowCamera->bUsePawnControlRotation = false;

	RodMesh = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("RodMesh"));
	RodMesh->SetupAttachment(GetMesh());
	RodMesh->SetCollisionEnabled(ECollisionEnabled::NoCollision);

	RodTip = CreateDefaultSubobject<USceneComponent>(TEXT("RodTip"));
	RodTip->SetupAttachment(RootComponent);
	RodTip->SetRelativeLocation(FVector(180.f, 35.f, 90.f));

	Fishing = CreateDefaultSubobject<UFishingComponent>(TEXT("Fishing"));
}

void AFishingCharacter::BeginPlay()
{
	Super::BeginPlay();

	if (GetMesh() && GetMesh()->DoesSocketExist(HandSocketName))
	{
		RodMesh->AttachToComponent(GetMesh(), FAttachmentTransformRules::SnapToTargetNotIncludingScale, HandSocketName);
	}

	Fishing->OnLoadoutChanged.AddDynamic(this, &AFishingCharacter::HandleLoadoutChanged);
	HandleLoadoutChanged();
}

void AFishingCharacter::HandleLoadoutChanged()
{
	const FTackleLoadout CurrentLoadout = Fishing->GetLoadout();
	const URodData* Rod = CurrentLoadout.Rod;

	UStaticMesh* RodStaticMesh = (Rod && !Rod->Mesh.IsNull()) ? Rod->Mesh.LoadSynchronous() : nullptr;
	RodMesh->SetStaticMesh(RodStaticMesh);

	if (RodStaticMesh && RodMesh->DoesSocketExist(TEXT("Tip")))
	{
		RodTip->AttachToComponent(RodMesh, FAttachmentTransformRules::SnapToTargetNotIncludingScale, TEXT("Tip"));
	}
	else
	{
		// Нет модели удилища — кончик «в воздухе» перед персонажем, по длине удилища
		RodTip->AttachToComponent(RootComponent, FAttachmentTransformRules::KeepRelativeTransform);
		const float Len = Rod ? Rod->LengthM : 2.5f;
		RodTip->SetRelativeLocation(FVector(Len * 70.f, 35.f, 60.f + Len * 12.f));
	}
	Fishing->SetRodTip(RodTip);
}

// ============================================================================
// Ввод
// ============================================================================

void AFishingCharacter::EnsureDefaultInput()
{
	if (MappingContext)
	{
		return; // назначены свои ассеты в Blueprint
	}

	MappingContext = NewObject<UInputMappingContext>(this, TEXT("IMC_FishingDefault"));

	auto MakeAction = [this](const TCHAR* ActionName, EInputActionValueType Type)
	{
		UInputAction* NewAction = NewObject<UInputAction>(this, ActionName);
		NewAction->ValueType = Type;
		return NewAction;
	};

	MoveAction = MakeAction(TEXT("IA_Move"), EInputActionValueType::Axis2D);
	LookAction = MakeAction(TEXT("IA_Look"), EInputActionValueType::Axis2D);
	PrimaryAction = MakeAction(TEXT("IA_Primary"), EInputActionValueType::Boolean);
	LiftAction = MakeAction(TEXT("IA_Lift"), EInputActionValueType::Boolean);
	StrikeAction = MakeAction(TEXT("IA_Strike"), EInputActionValueType::Boolean);
	DragAction = MakeAction(TEXT("IA_Drag"), EInputActionValueType::Axis1D);
	ReelSpeedAction = MakeAction(TEXT("IA_ReelSpeed"), EInputActionValueType::Axis1D);
	FloatDepthAction = MakeAction(TEXT("IA_FloatDepth"), EInputActionValueType::Axis1D);
	CancelAction = MakeAction(TEXT("IA_Cancel"), EInputActionValueType::Boolean);
	KeepAction = MakeAction(TEXT("IA_Keep"), EInputActionValueType::Boolean);
	ReleaseAction = MakeAction(TEXT("IA_Release"), EInputActionValueType::Boolean);
	SellAction = MakeAction(TEXT("IA_Sell"), EInputActionValueType::Boolean);

	SwitchSlotActions.Reset();
	const TCHAR* SlotNames[] = { TEXT("IA_Slot1"), TEXT("IA_Slot2"), TEXT("IA_Slot3"), TEXT("IA_Slot4"), TEXT("IA_Slot5") };
	for (const TCHAR* SlotName : SlotNames)
	{
		SwitchSlotActions.Add(MakeAction(SlotName, EInputActionValueType::Boolean));
	}

	UInputMappingContext* IMC = MappingContext;
	auto Negate = [IMC]() { return NewObject<UInputModifierNegate>(IMC); };
	auto Swizzle = [IMC]() { return NewObject<UInputModifierSwizzleAxis>(IMC); }; // X -> Y

	// WASD -> 2D-ось. Ссылку на маппинг используем сразу, до следующего MapKey (массив может переехать).
	IMC->MapKey(MoveAction, EKeys::W).Modifiers.Add(Swizzle());
	{
		FEnhancedActionKeyMapping& MapS = IMC->MapKey(MoveAction, EKeys::S);
		MapS.Modifiers.Add(Swizzle());
		MapS.Modifiers.Add(Negate());
	}
	IMC->MapKey(MoveAction, EKeys::D);
	IMC->MapKey(MoveAction, EKeys::A).Modifiers.Add(Negate());

	IMC->MapKey(LookAction, EKeys::Mouse2D);

	IMC->MapKey(PrimaryAction, EKeys::LeftMouseButton);
	IMC->MapKey(LiftAction, EKeys::RightMouseButton);
	IMC->MapKey(StrikeAction, EKeys::SpaceBar);
	IMC->MapKey(DragAction, EKeys::MouseScrollUp);
	IMC->MapKey(DragAction, EKeys::MouseScrollDown).Modifiers.Add(Negate());
	IMC->MapKey(ReelSpeedAction, EKeys::E);
	IMC->MapKey(ReelSpeedAction, EKeys::Q).Modifiers.Add(Negate());
	IMC->MapKey(FloatDepthAction, EKeys::X);
	IMC->MapKey(FloatDepthAction, EKeys::Z).Modifiers.Add(Negate());
	IMC->MapKey(CancelAction, EKeys::R);
	IMC->MapKey(KeepAction, EKeys::F);
	IMC->MapKey(ReleaseAction, EKeys::G);
	IMC->MapKey(SellAction, EKeys::K);

	const FKey SlotKeys[] = { EKeys::One, EKeys::Two, EKeys::Three, EKeys::Four, EKeys::Five };
	for (int32 i = 0; i < SwitchSlotActions.Num(); ++i)
	{
		IMC->MapKey(SwitchSlotActions[i], SlotKeys[i]);
	}
}

void AFishingCharacter::PawnClientRestart()
{
	Super::PawnClientRestart();
	EnsureDefaultInput();

	if (const APlayerController* PC = Cast<APlayerController>(GetController()))
	{
		if (UEnhancedInputLocalPlayerSubsystem* InputSubsystem = ULocalPlayer::GetSubsystem<UEnhancedInputLocalPlayerSubsystem>(PC->GetLocalPlayer()))
		{
			InputSubsystem->AddMappingContext(MappingContext, 0);
		}
	}
}

void AFishingCharacter::SetupPlayerInputComponent(UInputComponent* PlayerInputComponent)
{
	Super::SetupPlayerInputComponent(PlayerInputComponent);
	EnsureDefaultInput();

	UEnhancedInputComponent* EIC = Cast<UEnhancedInputComponent>(PlayerInputComponent);
	if (!EIC)
	{
		UE_LOG(LogFishing, Error, TEXT("Нужен EnhancedInputComponent: Project Settings -> Input -> Default Input Component Class."));
		return;
	}

	EIC->BindAction(MoveAction, ETriggerEvent::Triggered, this, &AFishingCharacter::OnMove);
	EIC->BindAction(LookAction, ETriggerEvent::Triggered, this, &AFishingCharacter::OnLook);
	EIC->BindAction(PrimaryAction, ETriggerEvent::Started, this, &AFishingCharacter::OnPrimaryStarted);
	EIC->BindAction(PrimaryAction, ETriggerEvent::Triggered, this, &AFishingCharacter::OnPrimaryHeld);
	EIC->BindAction(PrimaryAction, ETriggerEvent::Completed, this, &AFishingCharacter::OnPrimaryReleased);
	EIC->BindAction(LiftAction, ETriggerEvent::Triggered, this, &AFishingCharacter::OnLiftHeld);
	EIC->BindAction(LiftAction, ETriggerEvent::Completed, this, &AFishingCharacter::OnLiftReleased);
	EIC->BindAction(StrikeAction, ETriggerEvent::Started, this, &AFishingCharacter::OnStrike);
	EIC->BindAction(DragAction, ETriggerEvent::Triggered, this, &AFishingCharacter::OnDrag);
	EIC->BindAction(ReelSpeedAction, ETriggerEvent::Started, this, &AFishingCharacter::OnReelSpeed);
	EIC->BindAction(FloatDepthAction, ETriggerEvent::Started, this, &AFishingCharacter::OnFloatDepth);
	EIC->BindAction(CancelAction, ETriggerEvent::Started, this, &AFishingCharacter::OnCancel);
	EIC->BindAction(KeepAction, ETriggerEvent::Started, this, &AFishingCharacter::OnKeep);
	EIC->BindAction(ReleaseAction, ETriggerEvent::Started, this, &AFishingCharacter::OnRelease);
	EIC->BindAction(SellAction, ETriggerEvent::Started, this, &AFishingCharacter::OnSell);

	using FSlotHandler = void (AFishingCharacter::*)(const FInputActionValue&);
	const FSlotHandler SlotHandlers[] = {
		&AFishingCharacter::OnSlot1, &AFishingCharacter::OnSlot2, &AFishingCharacter::OnSlot3,
		&AFishingCharacter::OnSlot4, &AFishingCharacter::OnSlot5 };
	for (int32 i = 0; i < SwitchSlotActions.Num() && i < static_cast<int32>(UE_ARRAY_COUNT(SlotHandlers)); ++i)
	{
		EIC->BindAction(SwitchSlotActions[i], ETriggerEvent::Started, this, SlotHandlers[i]);
	}
}

void AFishingCharacter::OnMove(const FInputActionValue& Value)
{
	// Пока снасть в воде — стоим на месте
	if (!GetController() || Fishing->GetFishingState() != EFishingState::Idle)
	{
		return;
	}
	const FVector2D Axis = Value.Get<FVector2D>();
	const FRotator YawRotation(0.f, GetControlRotation().Yaw, 0.f);
	AddMovementInput(FRotationMatrix(YawRotation).GetUnitAxis(EAxis::X), Axis.Y);
	AddMovementInput(FRotationMatrix(YawRotation).GetUnitAxis(EAxis::Y), Axis.X);
}

void AFishingCharacter::OnLook(const FInputActionValue& Value)
{
	const FVector2D Axis = Value.Get<FVector2D>();
	AddControllerYawInput(Axis.X);
	AddControllerPitchInput(-Axis.Y);
}

void AFishingCharacter::OnPrimaryStarted(const FInputActionValue& Value)
{
	if (Fishing->GetFishingState() == EFishingState::Idle)
	{
		Fishing->BeginCast();
	}
}

void AFishingCharacter::OnPrimaryHeld(const FInputActionValue& Value)
{
	const EFishingState State = Fishing->GetFishingState();
	if (State == EFishingState::InWater || State == EFishingState::Bite || State == EFishingState::Fighting)
	{
		Fishing->SetReelInput(ReelSpeed01);
	}
}

void AFishingCharacter::OnPrimaryReleased(const FInputActionValue& Value)
{
	if (Fishing->GetFishingState() == EFishingState::ChargingCast)
	{
		Fishing->ReleaseCast();
	}
	Fishing->SetReelInput(0.f);
}

void AFishingCharacter::OnLiftHeld(const FInputActionValue& Value)
{
	Fishing->SetRodLift(1.f);
}

void AFishingCharacter::OnLiftReleased(const FInputActionValue& Value)
{
	Fishing->SetRodLift(0.f);
}

void AFishingCharacter::OnStrike(const FInputActionValue& Value)
{
	Fishing->Strike();
}

void AFishingCharacter::OnDrag(const FInputActionValue& Value)
{
	Fishing->AdjustDrag(Value.Get<float>() * 0.05f);
}

void AFishingCharacter::OnReelSpeed(const FInputActionValue& Value)
{
	ReelSpeed01 = FMath::Clamp(ReelSpeed01 + FMath::Sign(Value.Get<float>()) * 0.1f, 0.1f, 1.f);
	Fishing->ShowMessage(FText::Format(LOCTEXT("ReelSpeed", "Скорость подмотки: {0}%"),
		FText::AsNumber(FMath::RoundToInt(ReelSpeed01 * 100.f))));
}

void AFishingCharacter::OnFloatDepth(const FInputActionValue& Value)
{
	Fishing->SetFloatDepth(Fishing->GetFloatDepthM() + FMath::Sign(Value.Get<float>()) * 0.25f);
	Fishing->ShowMessage(FText::Format(LOCTEXT("FloatDepth", "Глубина спуска: {0} м"),
		FText::AsNumber(Fishing->GetFloatDepthM())));
}

void AFishingCharacter::OnCancel(const FInputActionValue& Value)
{
	Fishing->CancelAndReelIn();
}

void AFishingCharacter::OnKeep(const FInputActionValue& Value)
{
	Fishing->ConfirmCatch(true);
}

void AFishingCharacter::OnRelease(const FInputActionValue& Value)
{
	Fishing->ConfirmCatch(false);
}

void AFishingCharacter::OnSell(const FInputActionValue& Value)
{
	if (UFishingProfileSubsystem* Profile = UFishingProfileSubsystem::Get(this))
	{
		const int64 Earned = Profile->SellKeepnet();
		Fishing->ShowMessage(FText::Format(LOCTEXT("SoldKeepnet", "Садок продан: +{0} серебра"), FText::AsNumber(Earned)));
	}
}

void AFishingCharacter::SwitchSlot(int32 SlotIndex)
{
	if (Fishing->GetFishingState() != EFishingState::Idle)
	{
		Fishing->ShowMessage(LOCTEXT("ReelInFirst", "Сначала смотай снасть (R)"));
		return;
	}
	UFishingProfileSubsystem* Profile = UFishingProfileSubsystem::Get(this);
	if (!Profile)
	{
		return;
	}
	const ETackleSlot Slot = static_cast<ETackleSlot>(FMath::Clamp(SlotIndex, 0, 4));
	if (Profile->EquipNextInSlot(Slot))
	{
		if (const UTackleItemData* Item = Profile->GetEquippedItem(Slot))
		{
			Fishing->ShowMessage(FText::Format(LOCTEXT("Equipped", "Надето: {0}"), Item->DisplayName));
		}
	}
}

#undef LOCTEXT_NAMESPACE
