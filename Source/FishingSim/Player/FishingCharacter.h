#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Character.h"
#include "InputActionValue.h"
#include "FishingCharacter.generated.h"

class UCameraComponent;
class USpringArmComponent;
class UStaticMeshComponent;
class UFishingComponent;
class UInputAction;
class UInputMappingContext;

/**
 * Рыбак от третьего лица. Работает «из коробки»: если Input-ассеты не назначены,
 * раскладка клавиш создаётся в коде (см. EnsureDefaultInput).
 *
 *   WASD / мышь — ходьба и обзор        ЛКМ (держать) — замах / отпустить — заброс; в воде — подмотка
 *   ПКМ (держать) — поднять удилище      Пробел — подсечка / подёргивание приманки
 *   Колесо — фрикцион                    Q / E — скорость подмотки
 *   Z / X — глубина поплавка             R — смотать снасть
 *   F — в садок, G — отпустить           K — продать садок (отладка)
 *   1..5 — сменить удилище/катушку/леску/крючок/наживку
 */
UCLASS()
class FISHINGSIM_API AFishingCharacter : public ACharacter
{
	GENERATED_BODY()

public:
	AFishingCharacter();

	virtual void SetupPlayerInputComponent(UInputComponent* PlayerInputComponent) override;
	virtual void PawnClientRestart() override;

	UFUNCTION(BlueprintPure, Category = "Fishing")
	UFishingComponent* GetFishing() const { return Fishing; }

	UFUNCTION(BlueprintPure, Category = "Fishing")
	float GetReelSpeedSetting() const { return ReelSpeed01; }

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Fishing")
	TObjectPtr<USpringArmComponent> CameraBoom;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Fishing")
	TObjectPtr<UCameraComponent> FollowCamera;

	/** Меш удилища (берётся из данных удилища). Если у меша есть сокет "Tip" — леска идёт из него. */
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Fishing")
	TObjectPtr<UStaticMeshComponent> RodMesh;

	/** Точка кончика удилища. */
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Fishing")
	TObjectPtr<USceneComponent> RodTip;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Fishing")
	TObjectPtr<UFishingComponent> Fishing;

	/** Сокет руки на скелете персонажа, куда крепится удилище. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Fishing")
	FName HandSocketName = TEXT("hand_r");

	// --------- Ввод (можно оставить пустым — создастся автоматически) ---------

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Input")
	TObjectPtr<UInputMappingContext> MappingContext;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Input")
	TObjectPtr<UInputAction> MoveAction;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Input")
	TObjectPtr<UInputAction> LookAction;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Input")
	TObjectPtr<UInputAction> PrimaryAction;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Input")
	TObjectPtr<UInputAction> LiftAction;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Input")
	TObjectPtr<UInputAction> StrikeAction;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Input")
	TObjectPtr<UInputAction> DragAction;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Input")
	TObjectPtr<UInputAction> ReelSpeedAction;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Input")
	TObjectPtr<UInputAction> FloatDepthAction;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Input")
	TObjectPtr<UInputAction> CancelAction;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Input")
	TObjectPtr<UInputAction> KeepAction;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Input")
	TObjectPtr<UInputAction> ReleaseAction;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Input")
	TObjectPtr<UInputAction> SellAction;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Input")
	TArray<TObjectPtr<UInputAction>> SwitchSlotActions;

protected:
	virtual void BeginPlay() override;

private:
	void EnsureDefaultInput();

	void OnMove(const FInputActionValue& Value);
	void OnLook(const FInputActionValue& Value);
	void OnPrimaryStarted(const FInputActionValue& Value);
	void OnPrimaryHeld(const FInputActionValue& Value);
	void OnPrimaryReleased(const FInputActionValue& Value);
	void OnLiftHeld(const FInputActionValue& Value);
	void OnLiftReleased(const FInputActionValue& Value);
	void OnStrike(const FInputActionValue& Value);
	void OnDrag(const FInputActionValue& Value);
	void OnReelSpeed(const FInputActionValue& Value);
	void OnFloatDepth(const FInputActionValue& Value);
	void OnCancel(const FInputActionValue& Value);
	void OnKeep(const FInputActionValue& Value);
	void OnRelease(const FInputActionValue& Value);
	void OnSell(const FInputActionValue& Value);
	void SwitchSlot(int32 SlotIndex);
	void OnSlot1(const FInputActionValue& Value) { SwitchSlot(0); }
	void OnSlot2(const FInputActionValue& Value) { SwitchSlot(1); }
	void OnSlot3(const FInputActionValue& Value) { SwitchSlot(2); }
	void OnSlot4(const FInputActionValue& Value) { SwitchSlot(3); }
	void OnSlot5(const FInputActionValue& Value) { SwitchSlot(4); }

	UFUNCTION()
	void HandleLoadoutChanged();

	float ReelSpeed01 = 0.6f;
};
