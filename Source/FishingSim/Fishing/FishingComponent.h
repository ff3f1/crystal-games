#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "Core/FishingTypes.h"
#include "Data/TackleData.h"
#include "Fishing/FishFightSimulator.h"
#include "FishingComponent.generated.h"

class AFishingLureActor;
class AFishingZone;
class UFishingProfileSubsystem;
struct FBiteContext;
struct FBiteCandidate;

DECLARE_DYNAMIC_MULTICAST_DELEGATE_TwoParams(FOnFishingStateChanged, EFishingState, NewState, EFishingState, OldState);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnFishBite, float, BiteStrength);
DECLARE_DYNAMIC_MULTICAST_DELEGATE(FOnFishHooked);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnFishLanded, const FCatchRecord&, Catch);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnFishLost, EFishLoseReason, Reason);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnFishingMessage, const FText&, Message);
DECLARE_DYNAMIC_MULTICAST_DELEGATE(FOnFishingLoadoutChanged);

/**
 * Вся логика рыбалки. Повесь на персонажа (AFishingCharacter уже содержит его).
 *
 * Управление (вызывается из инпута или Blueprint):
 *   BeginCast/ReleaseCast — заброс с набором силы; SetReelInput — вращение катушки;
 *   SetRodLift — подъём удилища (подкачка); AdjustDrag — фрикцион; Strike — подсечка / подёргивание;
 *   ConfirmCatch — в садок или отпустить; CancelAndReelIn — смотать снасть.
 */
UCLASS(ClassGroup = (Fishing), meta = (BlueprintSpawnableComponent))
class FISHINGSIM_API UFishingComponent : public UActorComponent
{
	GENERATED_BODY()

public:
	UFishingComponent();

	virtual void TickComponent(float DeltaTime, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;

	// ===================== Управление =====================

	UFUNCTION(BlueprintCallable, Category = "Fishing|Input")
	void BeginCast();

	UFUNCTION(BlueprintCallable, Category = "Fishing|Input")
	void ReleaseCast();

	/** 0..1 — скорость вращения ручки катушки. */
	UFUNCTION(BlueprintCallable, Category = "Fishing|Input")
	void SetReelInput(float Value01);

	/** 0..1 — насколько поднято удилище. */
	UFUNCTION(BlueprintCallable, Category = "Fishing|Input")
	void SetRodLift(float Value01);

	/** Изменить затяжку фрикциона (доля от максимума катушки). */
	UFUNCTION(BlueprintCallable, Category = "Fishing|Input")
	void AdjustDrag(float Delta01);

	UFUNCTION(BlueprintCallable, Category = "Fishing|Input")
	void SetDrag01(float Value01);

	/** Подсечка во время поклёвки или подёргивание приманки в проводке. */
	UFUNCTION(BlueprintCallable, Category = "Fishing|Input")
	void Strike();

	UFUNCTION(BlueprintCallable, Category = "Fishing|Input")
	void CancelAndReelIn();

	UFUNCTION(BlueprintCallable, Category = "Fishing|Input")
	void ConfirmCatch(bool bKeepInNet);

	/** Глубина спуска поплавочной снасти, м. */
	UFUNCTION(BlueprintCallable, Category = "Fishing|Input")
	void SetFloatDepth(float InDepthM);

	// ===================== Снасть =====================

	/** Собрать снасть вручную (только в состоянии Idle). */
	UFUNCTION(BlueprintCallable, Category = "Fishing|Tackle")
	bool SetLoadout(const FTackleLoadout& NewLoadout);

	/** Взять надетое снаряжение из профиля игрока. */
	UFUNCTION(BlueprintCallable, Category = "Fishing|Tackle")
	void RefreshLoadoutFromProfile();

	/** Точка кончика удилища (компонент + опционально сокет). */
	UFUNCTION(BlueprintCallable, Category = "Fishing|Tackle")
	void SetRodTip(USceneComponent* TipComponent, FName TipSocket = NAME_None);

	// ===================== Состояние для UI =====================

	UFUNCTION(BlueprintPure, Category = "Fishing|State")
	EFishingState GetFishingState() const { return FishingState; }

	UFUNCTION(BlueprintPure, Category = "Fishing|State")
	float GetCastCharge() const { return CastCharge; }

	UFUNCTION(BlueprintPure, Category = "Fishing|State")
	float GetTensionKg() const { return TensionKg; }

	/** Натяжение относительно самого слабого звена (1 = на грани обрыва). */
	UFUNCTION(BlueprintPure, Category = "Fishing|State")
	float GetTension01() const;

	/** Где на шкале натяжения стоит фрикцион (0..1 от слабого звена). */
	UFUNCTION(BlueprintPure, Category = "Fishing|State")
	float GetDragMark01() const;

	UFUNCTION(BlueprintPure, Category = "Fishing|State")
	float GetWeakestLinkKg() const;

	UFUNCTION(BlueprintPure, Category = "Fishing|State")
	float GetDragKg() const;

	UFUNCTION(BlueprintPure, Category = "Fishing|State")
	float GetDrag01() const { return DragSetting01; }

	UFUNCTION(BlueprintPure, Category = "Fishing|State")
	bool IsDragSlipping() const { return bDragSlipping; }

	UFUNCTION(BlueprintPure, Category = "Fishing|State")
	float GetLineOutM() const { return LineOutM; }

	UFUNCTION(BlueprintPure, Category = "Fishing|State")
	float GetLineWear01() const { return Fight.LineWear; }

	UFUNCTION(BlueprintPure, Category = "Fishing|State")
	float GetLureDepthM() const { return LureDepthM; }

	UFUNCTION(BlueprintPure, Category = "Fishing|State")
	float GetBottomDepthM() const { return BottomDepthM; }

	UFUNCTION(BlueprintPure, Category = "Fishing|State")
	float GetFloatDepthM() const { return FloatDepthM; }

	UFUNCTION(BlueprintPure, Category = "Fishing|State")
	float GetLureSpeedMps() const { return LureSpeedMps; }

	/** Ожидаемое число поклёвок в минуту при текущей снасти и месте (для «прогноза клёва»). */
	UFUNCTION(BlueprintPure, Category = "Fishing|State")
	float GetBiteRatePerMinute() const { return CachedBiteRatePerMin; }

	UFUNCTION(BlueprintPure, Category = "Fishing|State")
	FTackleLoadout GetLoadout() const { return Loadout; }

	/** Рыба на крючке (вид/вес лучше не показывать игроку до подсачека). */
	UFUNCTION(BlueprintPure, Category = "Fishing|State")
	FHookedFish GetHookedFish() const { return HookedFish; }

	UFUNCTION(BlueprintPure, Category = "Fishing|State")
	FCatchRecord GetPendingCatch() const { return PendingCatch; }

	UFUNCTION(BlueprintPure, Category = "Fishing|State")
	EFishLoseReason GetLastLoseReason() const { return LastLoseReason; }

	UFUNCTION(BlueprintPure, Category = "Fishing|State")
	FText GetLastMessage() const { return LastMessage; }

	UFUNCTION(BlueprintPure, Category = "Fishing|State")
	float GetLastMessageAge() const;

	UFUNCTION(BlueprintPure, Category = "Fishing|State")
	FVector GetRodTipLocation() const;

	UFUNCTION(BlueprintPure, Category = "Fishing|State")
	AFishingLureActor* GetLure() const { return Lure; }

	UFUNCTION(BlueprintPure, Category = "Fishing|State")
	AFishingZone* GetCurrentZone() const { return CurrentZone.Get(); }

	UFUNCTION(BlueprintPure, Category = "Fishing|State")
	static FText GetLoseReasonText(EFishLoseReason Reason);

	/** Показать сообщение игроку (HUD читает GetLastMessage, UI может слушать OnMessage). */
	UFUNCTION(BlueprintCallable, Category = "Fishing|State")
	void ShowMessage(const FText& Text);

	// ===================== Настройки =====================

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Fishing|Config")
	TSubclassOf<AFishingLureActor> LureClass;

	/** Скорость вылета приманки при полной силе и идеальном весе, см/с. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Fishing|Config")
	float MaxCastSpeed = 2600.f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Fishing|Config")
	float ChargeTime = 1.1f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Fishing|Config")
	float CastPitchDeg = 30.f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Fishing|Config")
	float LandingDistanceM = 2.f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Fishing|Config")
	float RetrieveFinishDistanceM = 2.f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Fishing|Config")
	float BiteCheckInterval = 0.5f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Fishing|Config")
	float LostResetDelay = 2.f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Fishing|Config")
	bool bDrawDebugLine = true;

	// ===================== События =====================

	UPROPERTY(BlueprintAssignable, Category = "Fishing|Events")
	FOnFishingStateChanged OnStateChanged;

	UPROPERTY(BlueprintAssignable, Category = "Fishing|Events")
	FOnFishBite OnBite;

	UPROPERTY(BlueprintAssignable, Category = "Fishing|Events")
	FOnFishHooked OnFishHooked;

	UPROPERTY(BlueprintAssignable, Category = "Fishing|Events")
	FOnFishLanded OnFishLanded;

	UPROPERTY(BlueprintAssignable, Category = "Fishing|Events")
	FOnFishLost OnFishLost;

	UPROPERTY(BlueprintAssignable, Category = "Fishing|Events")
	FOnFishingMessage OnMessage;

	UPROPERTY(BlueprintAssignable, Category = "Fishing|Events")
	FOnFishingLoadoutChanged OnLoadoutChanged;

protected:
	virtual void BeginPlay() override;
	virtual void EndPlay(const EEndPlayReason::Type EndPlayReason) override;

private:
	void SetState(EFishingState NewState);

	void TickCharging(float DeltaTime);
	void TickFlying(float DeltaTime);
	void TickInWater(float DeltaTime);
	void TickBite(float DeltaTime);
	void TickFighting(float DeltaTime);
	void TickLost(float DeltaTime);
	void DrawDebugTackle() const;

	void HandleLureLanded(bool bInWater, AFishingZone* Zone);
	void StartBite(const FBiteCandidate& Candidate);
	void HookFish(float HookQuality);
	void LoseFish(EFishLoseReason Reason);
	void LandFish();
	void DestroyLure();
	void ApplyPendingLoadout();
	bool BuildBiteContext(FBiteContext& OutContext) const;
	FFightTackle BuildFightTackle() const;
	UFishingProfileSubsystem* GetProfile() const;
	UFUNCTION()
	void HandleProfileLoadoutChanged();

	UPROPERTY(Transient)
	TObjectPtr<AFishingLureActor> Lure;

	UPROPERTY(Transient)
	FTackleLoadout Loadout;

	UPROPERTY(Transient)
	FHookedFish HookedFish;

	UPROPERTY(Transient)
	FCatchRecord PendingCatch;

	TWeakObjectPtr<AFishingZone> CurrentZone;
	TWeakObjectPtr<USceneComponent> RodTipComponent;
	FName RodTipSocketName;

	FFishFightSimulator Fight;

	EFishingState FishingState = EFishingState::Idle;
	EFishLoseReason LastLoseReason = EFishLoseReason::None;
	FText LastMessage;
	float LastMessageTime = -100.f;

	float CastCharge = 0.f;
	float LineOutM = 0.f;
	float DragSetting01 = 0.4f;
	float ReelInput01 = 0.f;
	float RodLift01 = 0.f;
	float TensionKg = 0.f;
	bool bDragSlipping = false;

	float FloatDepthM = 1.5f;
	float LureDepthM = 0.f;
	float BottomDepthM = 0.f;
	bool bLureOnBottom = false;
	float LureSpeedMps = 0.f;
	float TwitchTimer = 0.f;

	float BiteCheckTimer = 0.f;
	float BiteCooldown = 0.f;
	float BiteTimer = 0.f;
	float BiteDuration = 1.f;
	float CachedBiteRatePerMin = 0.f;

	float StateTimer = 0.f;
	bool bLoadoutDirty = false;
};
