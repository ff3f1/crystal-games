#pragma once

#include "CoreMinimal.h"
#include "Subsystems/WorldSubsystem.h"
#include "Core/FishingTypes.h"
#include "FishingWorldSubsystem.generated.h"

class AFishingZone;

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnFishingWeatherChanged, EFishingWeather, NewWeather);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FOnFishingHourChanged, int32, NewHour);

/**
 * Окружающая среда: время суток, погода, атмосферное давление, температура воды по глубине.
 * Плюс реестр зон водоёма. Доступ: UFishingWorldSubsystem::Get(this).
 */
UCLASS()
class FISHINGSIM_API UFishingWorldSubsystem : public UTickableWorldSubsystem
{
	GENERATED_BODY()

public:
	virtual void Initialize(FSubsystemCollectionBase& Collection) override;
	virtual void Deinitialize() override;
	virtual void Tick(float DeltaTime) override;
	virtual TStatId GetStatId() const override;

	UFUNCTION(BlueprintPure, Category = "Fishing|World", meta = (WorldContext = "WorldContextObject"))
	static UFishingWorldSubsystem* Get(const UObject* WorldContextObject);

	// ---------------- Время ----------------

	UPROPERTY(BlueprintReadWrite, Category = "Fishing|Time")
	float TimeOfDayHours = 6.f;

	UPROPERTY(BlueprintReadWrite, Category = "Fishing|Time")
	float RealMinutesPerGameDay = 48.f;

	UPROPERTY(BlueprintReadWrite, Category = "Fishing|Time")
	bool bTimeFrozen = false;

	UPROPERTY(BlueprintReadOnly, Category = "Fishing|Time")
	int32 DayIndex = 0;

	/** Перемотать время (например, «ночёвка» у костра). */
	UFUNCTION(BlueprintCallable, Category = "Fishing|Time")
	void SkipHours(float Hours);

	UFUNCTION(BlueprintPure, Category = "Fishing|Time")
	FText GetTimeText() const;

	/** 0 ночью, 1 в полдень. */
	UFUNCTION(BlueprintPure, Category = "Fishing|Time")
	float GetDaylight() const;

	/** Солнце (DirectionalLight, Mobility = Movable) будет вращаться по времени суток. */
	UFUNCTION(BlueprintCallable, Category = "Fishing|Time")
	void SetSunActor(AActor* InSunActor, float InSunYawDeg = -30.f);

	// ---------------- Погода ----------------

	UPROPERTY(BlueprintReadOnly, Category = "Fishing|Weather")
	EFishingWeather Weather = EFishingWeather::Clear;

	UPROPERTY(BlueprintReadOnly, Category = "Fishing|Weather")
	float AirTempC = 18.f;

	UPROPERTY(BlueprintReadOnly, Category = "Fishing|Weather")
	float PressureHpa = 1013.f;

	/** Тренд давления, гПа/игровой час (падающее — к непогоде). */
	UPROPERTY(BlueprintReadOnly, Category = "Fishing|Weather")
	float PressureTrendHpaPerHour = 0.f;

	UPROPERTY(BlueprintReadOnly, Category = "Fishing|Weather")
	float WindSpeedMps = 2.f;

	UPROPERTY(BlueprintReadWrite, Category = "Fishing|Weather")
	float SeasonSurfaceWaterTempC = 19.f;

	UPROPERTY(BlueprintReadWrite, Category = "Fishing|Weather")
	float ThermoclineDepthM = 6.f;

	UPROPERTY(BlueprintReadWrite, Category = "Fishing|Weather")
	float DeepWaterTempC = 9.f;

	UFUNCTION(BlueprintCallable, Category = "Fishing|Weather")
	void SetWeather(EFishingWeather NewWeather);

	UFUNCTION(BlueprintPure, Category = "Fishing|Weather")
	float GetWaterTemperatureAt(float InDepthM) const;

	/** Множитель клёва от давления: стабильное — хорошо, резкие перепады — плохо. */
	UFUNCTION(BlueprintPure, Category = "Fishing|Weather")
	float GetPressureActivityFactor(float Sensitivity) const;

	UFUNCTION(BlueprintPure, Category = "Fishing|Weather")
	static FText GetWeatherText(EFishingWeather InWeather);

	UPROPERTY(BlueprintAssignable, Category = "Fishing|Events")
	FOnFishingWeatherChanged OnWeatherChanged;

	UPROPERTY(BlueprintAssignable, Category = "Fishing|Events")
	FOnFishingHourChanged OnHourChanged;

	// ---------------- Зоны ----------------

	void RegisterZone(AFishingZone* Zone);
	void UnregisterZone(AFishingZone* Zone);

	UFUNCTION(BlueprintPure, Category = "Fishing|World")
	AFishingZone* FindZoneAt(const FVector& WorldLocation) const;

protected:
	virtual bool DoesSupportWorldType(const EWorldType::Type WorldType) const override;

private:
	void UpdateWeather(float DeltaHours);
	void UpdateSun();

	TArray<TWeakObjectPtr<AFishingZone>> Zones;
	TWeakObjectPtr<AActor> SunActor;
	float SunYawDeg = -30.f;
	float HoursToWeatherChange = 3.f;
	int32 LastHour = -1;
};
