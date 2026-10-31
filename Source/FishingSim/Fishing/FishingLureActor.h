#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "FishingLureActor.generated.h"

class AFishingZone;
class UBaitData;
class UFishSpeciesData;
class UStaticMeshComponent;
class UStaticMesh;

UENUM(BlueprintType)
enum class ELureActorMode : uint8
{
	Flying,
	InWater,
	Inactive
};

DECLARE_MULTICAST_DELEGATE_TwoParams(FOnLureLandedNative, bool /*bInWater*/, AFishingZone* /*Zone*/);

/**
 * Приманка / поплавок в мире. Сам считает только полёт; в воде положением управляет UFishingComponent.
 * Сделай Blueprint-наследника, чтобы добавить всплески (Niagara), звук и анимацию поплавка
 * через события OnSplash / OnBiteVisual / OnFishHookedVisual / OnFishJumpVisual.
 */
UCLASS(Blueprintable)
class FISHINGSIM_API AFishingLureActor : public AActor
{
	GENERATED_BODY()

public:
	AFishingLureActor();

	virtual void Tick(float DeltaSeconds) override;

	void Launch(const FVector& InVelocity, float InAirDragPerSec);
	void StopHorizontalMotion();
	void SetupVisuals(const UBaitData* Bait, bool bShowFloat);
	void ShowHookedFish(const UFishSpeciesData* Species, float LengthCm);
	void HideFish();

	ELureActorMode GetMode() const { return Mode; }

	/** C++-событие приземления (компонент рыбалки подписывается на него). */
	FOnLureLandedNative OnLanded;

	UFUNCTION(BlueprintImplementableEvent, Category = "Fishing|Visual")
	void OnSplash(bool bLandedInWater);

	UFUNCTION(BlueprintImplementableEvent, Category = "Fishing|Visual")
	void OnBiteVisual(float Strength);

	UFUNCTION(BlueprintImplementableEvent, Category = "Fishing|Visual")
	void OnFishHookedVisual();

	UFUNCTION(BlueprintImplementableEvent, Category = "Fishing|Visual")
	void OnFishJumpVisual();

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Fishing")
	TObjectPtr<USceneComponent> Root;

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Fishing")
	TObjectPtr<UStaticMeshComponent> LureMesh;

	/** Поплавок (виден на поплавочной снасти). */
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Fishing")
	TObjectPtr<UStaticMeshComponent> FloatMesh;

	/** Модель пойманной рыбы. */
	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Fishing")
	TObjectPtr<UStaticMeshComponent> FishMesh;

	/** Максимальное время полёта — защита от падения «в бесконечность». */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Fishing")
	float MaxFlightTime = 8.f;

private:
	void TickFlight(float DeltaSeconds);

	ELureActorMode Mode = ELureActorMode::Inactive;
	FVector Velocity = FVector::ZeroVector;
	float AirDragPerSec = 0.1f;
	float FlightTime = 0.f;

	UPROPERTY(Transient)
	TObjectPtr<UStaticMesh> PlaceholderFishMesh;
};
