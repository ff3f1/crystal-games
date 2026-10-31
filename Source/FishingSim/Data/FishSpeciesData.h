#pragma once

#include "CoreMinimal.h"
#include "Engine/DataAsset.h"
#include "Core/FishingTypes.h"
#include "FishSpeciesData.generated.h"

class UStaticMesh;
class UTexture2D;

/**
 * Описание вида рыбы. Создаётся как Data Asset (ПКМ в Content Browser -> Miscellaneous -> Data Asset -> FishSpeciesData).
 * Все параметры подобраны так, чтобы поведение было «как в жизни»: глубина, температура, время клёва, погода, наживки, сила.
 */
UCLASS(BlueprintType)
class FISHINGSIM_API UFishSpeciesData : public UPrimaryDataAsset
{
	GENERATED_BODY()

public:
	// ---------------- Описание ----------------

	/** Уникальный ID вида (используется в сохранениях и на сервере). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Info")
	FName SpeciesId;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Info")
	FText DisplayName;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Info")
	FText LatinName;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Info", meta = (MultiLine = true))
	FText Description;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Info")
	TSoftObjectPtr<UTexture2D> Icon;

	// ---------------- Визуал ----------------

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Visual")
	TSoftObjectPtr<UStaticMesh> Mesh;

	/** Длина рыбы в меше при масштабе 1 (см) — чтобы модель масштабировалась под пойманный экземпляр. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Visual", meta = (ClampMin = "1"))
	float MeshLengthCm = 50.f;

	// ---------------- Размеры ----------------

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Size")
	FFishValueRange LengthCm = FFishValueRange(10.f, 40.f);

	/** Вес при минимальной и максимальной длине (между ними — кубическая зависимость). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Size")
	FFishValueRange WeightKg = FFishValueRange(0.05f, 1.f);

	/** Шанс трофея (экземпляр крупнее обычного максимума). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Size", meta = (ClampMin = "0", ClampMax = "1"))
	float TrophyChance = 0.02f;

	/** Во сколько раз трофей может превышать максимальную длину. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Size", meta = (ClampMin = "1"))
	float TrophyLengthFactor = 1.3f;

	/** Перекос распределения размеров: 1 = равномерно, 3 = в основном мелочь. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Size", meta = (ClampMin = "0.3"))
	float SizeSkew = 2.2f;

	// ---------------- Среда обитания ----------------

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Habitat")
	FFishValueRange DepthM = FFishValueRange(0.5f, 4.f);

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Habitat")
	float OptimalWaterTempC = 18.f;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Habitat", meta = (ClampMin = "0.5"))
	float TempToleranceC = 6.f;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Habitat")
	TArray<EBottomType> PreferredBottoms;

	/** Активность днём вне окон кормёжки. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Habitat", meta = (ClampMin = "0"))
	float DayActivity = 0.6f;

	/** Активность ночью (22:00–04:00). Для сома и налима — высокая. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Habitat", meta = (ClampMin = "0"))
	float NightActivity = 0.2f;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Habitat")
	TArray<FFeedingWindow> FeedingWindows;

	/** Множители активности по погоде (нет записи = 1). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Habitat")
	TMap<EFishingWeather, float> WeatherActivity;

	/** Чувствительность к перепадам атмосферного давления (0 — не реагирует). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Habitat", meta = (ClampMin = "0", ClampMax = "1"))
	float PressureSensitivity = 0.5f;

	// ---------------- Питание ----------------

	/** На что берёт и насколько охотно (нет записи = не берёт). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Diet")
	TMap<ELureType, float> LureAffinity;

	/** ItemId конкретных наживок/приманок, которые вид особенно любит (x1.5). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Diet")
	TArray<FName> FavoriteBaits;

	/** Подходящие номера крючков (международная шкала: больше номер — меньше крючок). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Diet")
	FFishValueRange HookSizeRange = FFishValueRange(6.f, 14.f);

	/** Осторожность к толстой/заметной леске (0..1). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Diet", meta = (ClampMin = "0", ClampMax = "1"))
	float LineShyness = 0.5f;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Diet")
	bool bPredator = false;

	// ---------------- Поклёвка ----------------

	/** Сколько секунд длится поклёвка (окно для подсечки). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Bite", meta = (ClampMin = "0.2"))
	float BiteWindowSec = 1.2f;

	/** Шанс самозасечки при атаке на искусственную приманку. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Bite", meta = (ClampMin = "0", ClampMax = "1"))
	float SelfHookChance = 0.15f;

	/** Насколько вид распространён (0.05 — редкий, 1 — обычный). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Bite", meta = (ClampMin = "0"))
	float Commonness = 1.f;

	// ---------------- Вываживание ----------------

	/** Максимальная тяга в кгс на 1 кг веса рыбы. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Fight", meta = (ClampMin = "0.05"))
	float PullFactor = 0.8f;

	/** Скорость рывка, м/с. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Fight", meta = (ClampMin = "0.3"))
	float BurstSpeedMps = 2.5f;

	/** Сколько секунд рыба весом 1 кг может бороться на максимуме (для крупных растёт как вес^0.35). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Fight", meta = (ClampMin = "1"))
	float EnduranceSec = 20.f;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Fight", meta = (ClampMin = "0", ClampMax = "1"))
	float Aggression = 0.5f;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Fight", meta = (ClampMin = "0", ClampMax = "1"))
	float JumpChance = 0.f;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Fight", meta = (ClampMin = "0", ClampMax = "1"))
	float HeadShakeChance = 0.2f;

	/** Уходит в коряги/траву при вываживании. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Fight")
	bool bSeeksCover = false;

	/** Прочность губы: < 1 — мягкий рот (лещ, карась), легко сходит при сильном натяжении. */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Fight", meta = (ClampMin = "0.2"))
	float MouthToughness = 1.f;

	/** Шанс перекусить леску за секунду тряски головой без металлического поводка (щука). */
	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Fight", meta = (ClampMin = "0", ClampMax = "1"))
	float TeethCutChance = 0.f;

	// ---------------- Экономика ----------------

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Economy", meta = (ClampMin = "0"))
	int32 PricePerKg = 30;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Economy", meta = (ClampMin = "0"))
	int32 XpBase = 5;

	UPROPERTY(EditDefaultsOnly, BlueprintReadOnly, Category = "Economy", meta = (ClampMin = "0"))
	float XpPerKg = 10.f;

	// ---------------- API ----------------

	UFUNCTION(BlueprintPure, Category = "Fish")
	float GetActivityAtHour(float Hour) const;

	UFUNCTION(BlueprintPure, Category = "Fish")
	float GetTemperatureFactor(float WaterTempC) const;

	UFUNCTION(BlueprintPure, Category = "Fish")
	float GetLureAffinity(ELureType Type) const;

	UFUNCTION(BlueprintPure, Category = "Fish")
	float GetWeatherFactor(EFishingWeather InWeather) const;

	UFUNCTION(BlueprintPure, Category = "Fish")
	float GetDepthFactor(float InDepthM) const;

	UFUNCTION(BlueprintPure, Category = "Fish")
	float GetWeightForLength(float InLengthCm) const;

	UFUNCTION(BlueprintPure, Category = "Fish")
	bool IsHookSuitable(int32 HookSize) const;
};
