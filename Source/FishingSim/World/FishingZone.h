#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "Core/FishingTypes.h"
#include "FishingZone.generated.h"

class UBoxComponent;
class UFishSpeciesData;

USTRUCT(BlueprintType)
struct FZoneFishEntry
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Fish")
	TObjectPtr<UFishSpeciesData> Species = nullptr;

	/** Численность вида в этой зоне. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Fish", meta = (ClampMin = "0"))
	float Abundance = 1.f;

	/** > 1 — рыба здесь крупнее обычного (трофейный пруд). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Fish", meta = (ClampMin = "0.1"))
	float SizeBias = 1.f;
};

/**
 * Зона водоёма. Поставь на уровень и растяни бокс по акватории:
 * ВЕРХНЯЯ грань бокса = уровень воды. Глубина считается трассировкой вниз до дна (ландшафт/меши).
 * Можно ставить несколько зон: заросший залив, русло, коряжник — с разной рыбой.
 */
UCLASS(Blueprintable)
class FISHINGSIM_API AFishingZone : public AActor
{
	GENERATED_BODY()

public:
	AFishingZone();

	UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category = "Zone")
	TObjectPtr<UBoxComponent> WaterBox;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Zone")
	FText ZoneName;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Zone")
	EBottomType BottomType = EBottomType::Mud;

	/** Кто тут водится. Пусто = все виды из каталога (отбор по глубине/температуре всё равно работает). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Zone")
	TArray<FZoneFishEntry> Fish;

	/** Общая плотность рыбы. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Zone", meta = (ClampMin = "0"))
	float FishDensity = 1.f;

	/** Прозрачность воды (0..1): в прозрачной рыба сильнее боится толстой лески. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Zone", meta = (ClampMin = "0", ClampMax = "1"))
	float WaterClarity = 0.5f;

	/** Шанс зацепа в секунду, когда приманка тащится по дну. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Zone", meta = (ClampMin = "0", ClampMax = "1"))
	float SnagChancePerSec = 0.01f;

	/** Глубина, если трассировка не нашла дно (м). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Zone|Depth", meta = (ClampMin = "0.1"))
	float FallbackDepthM = 3.f;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Zone|Depth", meta = (ClampMin = "1"))
	float MaxDepthM = 40.f;

	/** Акторы, которые не считаются дном (например, меш водной глади, если он с коллизией). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Zone|Depth")
	TArray<TObjectPtr<AActor>> ActorsIgnoredByBottomTrace;

	/** «Выловленность»: каждая пойманная рыба немного снижает клёв, со временем восстанавливается. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Zone|Pressure", meta = (ClampMin = "0", ClampMax = "1"))
	float PressurePerCatch = 0.06f;

	/** На сколько «выловленность» падает за реальную минуту. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Zone|Pressure", meta = (ClampMin = "0"))
	float PressureRecoveryPerMinute = 0.03f;

	UFUNCTION(BlueprintPure, Category = "Zone")
	float GetWaterSurfaceZ() const;

	UFUNCTION(BlueprintPure, Category = "Zone")
	bool ContainsXY(const FVector& WorldLocation) const;

	/** Глубина в точке, м. */
	UFUNCTION(BlueprintPure, Category = "Zone")
	float GetDepthAt(const FVector& WorldLocation) const;

	UFUNCTION(BlueprintCallable, Category = "Zone")
	void AddFishingPressure(float Amount);

	/** Множитель клёва от «выловленности» (1 — не тронута). */
	UFUNCTION(BlueprintPure, Category = "Zone")
	float GetPressureFactor() const;

protected:
	virtual void BeginPlay() override;
	virtual void EndPlay(const EEndPlayReason::Type EndPlayReason) override;

private:
	float GetCurrentPressure() const;

	float StoredPressure = 0.f;
	float PressureTimestamp = 0.f;
};
