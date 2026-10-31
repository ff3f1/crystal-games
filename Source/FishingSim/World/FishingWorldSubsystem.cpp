#include "World/FishingWorldSubsystem.h"
#include "World/FishingZone.h"
#include "Core/FishingSettings.h"
#include "Engine/Engine.h"
#include "Engine/World.h"
#include "GameFramework/Actor.h"

UFishingWorldSubsystem* UFishingWorldSubsystem::Get(const UObject* WorldContextObject)
{
	if (!GEngine || !WorldContextObject)
	{
		return nullptr;
	}
	const UWorld* World = GEngine->GetWorldFromContextObject(WorldContextObject, EGetWorldErrorMode::ReturnNull);
	return World ? World->GetSubsystem<UFishingWorldSubsystem>() : nullptr;
}

bool UFishingWorldSubsystem::DoesSupportWorldType(const EWorldType::Type WorldType) const
{
	return WorldType == EWorldType::Game || WorldType == EWorldType::PIE;
}

void UFishingWorldSubsystem::Initialize(FSubsystemCollectionBase& Collection)
{
	Super::Initialize(Collection);

	const UFishingSettings* Settings = UFishingSettings::Get();
	RealMinutesPerGameDay = Settings->RealMinutesPerGameDay;
	TimeOfDayHours = Settings->StartHour;
	SeasonSurfaceWaterTempC = Settings->SeasonSurfaceWaterTempC;
	LastHour = FMath::FloorToInt(TimeOfDayHours);

	PressureHpa = FMath::FRandRange(1005.f, 1022.f);
	PressureTrendHpaPerHour = FMath::FRandRange(-0.5f, 0.5f);
	Weather = FMath::RandBool() ? EFishingWeather::Clear : EFishingWeather::Cloudy;
	HoursToWeatherChange = FMath::FRandRange(1.5f, 4.f);
}

void UFishingWorldSubsystem::Deinitialize()
{
	Zones.Reset();
	SunActor.Reset();
	Super::Deinitialize();
}

TStatId UFishingWorldSubsystem::GetStatId() const
{
	RETURN_QUICK_DECLARE_CYCLE_STAT(UFishingWorldSubsystem, STATGROUP_Tickables);
}

void UFishingWorldSubsystem::Tick(float DeltaTime)
{
	if (!bTimeFrozen && RealMinutesPerGameDay > 0.f)
	{
		const float DeltaHours = DeltaTime * 24.f / (RealMinutesPerGameDay * 60.f);
		TimeOfDayHours += DeltaHours;
		if (TimeOfDayHours >= 24.f)
		{
			TimeOfDayHours -= 24.f;
			++DayIndex;
		}
		UpdateWeather(DeltaHours);

		const int32 Hour = FMath::FloorToInt(TimeOfDayHours);
		if (Hour != LastHour)
		{
			LastHour = Hour;
			OnHourChanged.Broadcast(Hour);
		}
	}
	UpdateSun();
}

void UFishingWorldSubsystem::SkipHours(float Hours)
{
	const float Clamped = FMath::Clamp(Hours, 0.f, 24.f);
	UpdateWeather(Clamped);
	TimeOfDayHours += Clamped;
	while (TimeOfDayHours >= 24.f)
	{
		TimeOfDayHours -= 24.f;
		++DayIndex;
	}
}

FText UFishingWorldSubsystem::GetTimeText() const
{
	const int32 TotalMinutes = FMath::FloorToInt(TimeOfDayHours * 60.f);
	return FText::FromString(FString::Printf(TEXT("%02d:%02d"), (TotalMinutes / 60) % 24, TotalMinutes % 60));
}

float UFishingWorldSubsystem::GetDaylight() const
{
	// Восход ~5:00, закат ~21:00 (летом)
	const float Phase = (TimeOfDayHours - 5.f) / 16.f;
	if (Phase <= 0.f || Phase >= 1.f)
	{
		return 0.f;
	}
	return FMath::Sin(Phase * UE_PI);
}

void UFishingWorldSubsystem::SetSunActor(AActor* InSunActor, float InSunYawDeg)
{
	SunActor = InSunActor;
	SunYawDeg = InSunYawDeg;
	UpdateSun();
}

void UFishingWorldSubsystem::UpdateSun()
{
	AActor* Sun = SunActor.Get();
	if (!Sun)
	{
		return;
	}
	// 13:00 — солнце в зените (pitch -90), 5:00 и 21:00 — горизонт
	const float Pitch = -((TimeOfDayHours - 5.f) / 16.f) * 180.f;
	Sun->SetActorRotation(FRotator(Pitch, SunYawDeg, 0.f));
}

void UFishingWorldSubsystem::SetWeather(EFishingWeather NewWeather)
{
	if (Weather == NewWeather)
	{
		return;
	}
	Weather = NewWeather;
	OnWeatherChanged.Broadcast(Weather);
}

void UFishingWorldSubsystem::UpdateWeather(float DeltaHours)
{
	if (DeltaHours <= 0.f)
	{
		return;
	}

	// Давление: случайное блуждание тренда + возврат к норме
	PressureTrendHpaPerHour += FMath::FRandRange(-0.6f, 0.6f) * DeltaHours;
	PressureTrendHpaPerHour += (1013.f - PressureHpa) * 0.015f * DeltaHours;
	PressureTrendHpaPerHour = FMath::Clamp(PressureTrendHpaPerHour, -2.5f, 2.5f);
	PressureHpa = FMath::Clamp(PressureHpa + PressureTrendHpaPerHour * DeltaHours, 980.f, 1045.f);

	// Смена погоды: падающее давление тянет к дождю, растущее — к ясной
	HoursToWeatherChange -= DeltaHours;
	if (HoursToWeatherChange <= 0.f)
	{
		HoursToWeatherChange = FMath::FRandRange(1.5f, 5.f);

		const float Trend = PressureTrendHpaPerHour;
		const bool bEarlyMorning = TimeOfDayHours >= 4.f && TimeOfDayHours <= 7.f;
		TArray<TPair<EFishingWeather, float>> Options;
		Options.Emplace(EFishingWeather::Clear, 1.f + FMath::Max(0.f, Trend) * 1.5f);
		Options.Emplace(EFishingWeather::Cloudy, 1.2f);
		Options.Emplace(EFishingWeather::Overcast, 0.8f + FMath::Max(0.f, -Trend) * 0.8f);
		Options.Emplace(EFishingWeather::Rain, 0.3f + FMath::Max(0.f, -Trend) * 1.2f);
		Options.Emplace(EFishingWeather::Storm, Trend < -1.2f ? 0.4f : 0.02f);
		Options.Emplace(EFishingWeather::Fog, bEarlyMorning ? 0.6f : 0.05f);

		float Total = 0.f;
		for (const TPair<EFishingWeather, float>& Option : Options)
		{
			Total += Option.Value;
		}
		float Roll = FMath::FRand() * Total;
		for (const TPair<EFishingWeather, float>& Option : Options)
		{
			Roll -= Option.Value;
			if (Roll <= 0.f)
			{
				SetWeather(Option.Key);
				break;
			}
		}
	}

	// Температура воздуха: минимум ~5:00, максимум ~15:00
	const float Daily = FMath::Sin((TimeOfDayHours - 9.f) / 24.f * 2.f * UE_PI);
	float WeatherShift = 0.f;
	float TargetWind = 2.f;
	switch (Weather)
	{
	case EFishingWeather::Clear:	WeatherShift = 2.f;		TargetWind = 1.5f;	break;
	case EFishingWeather::Cloudy:	WeatherShift = 0.f;		TargetWind = 3.f;	break;
	case EFishingWeather::Overcast:	WeatherShift = -1.5f;	TargetWind = 4.f;	break;
	case EFishingWeather::Rain:		WeatherShift = -3.f;	TargetWind = 5.f;	break;
	case EFishingWeather::Storm:	WeatherShift = -5.f;	TargetWind = 11.f;	break;
	case EFishingWeather::Fog:		WeatherShift = -2.f;	TargetWind = 0.5f;	break;
	default: break;
	}
	AirTempC = SeasonSurfaceWaterTempC + 1.f + 6.f * Daily + WeatherShift;
	WindSpeedMps = FMath::FInterpTo(WindSpeedMps, TargetWind, DeltaHours, 1.5f);
}

float UFishingWorldSubsystem::GetWaterTemperatureAt(float InDepthM) const
{
	// Поверхность прогревается к ~17:00, вода инертнее воздуха
	const float Daily = FMath::Sin((TimeOfDayHours - 11.f) / 24.f * 2.f * UE_PI);
	float Surface = SeasonSurfaceWaterTempC + 1.2f * Daily;
	if (Weather == EFishingWeather::Clear)
	{
		Surface += 0.6f;
	}

	const float Depth = FMath::Max(0.f, InDepthM);
	if (Depth <= ThermoclineDepthM)
	{
		return Surface - 0.15f * Depth;
	}
	// Ниже термоклина — быстро к температуре глубинной воды
	const float AtThermocline = Surface - 0.15f * ThermoclineDepthM;
	const float Below = Depth - ThermoclineDepthM;
	return FMath::Lerp(AtThermocline, DeepWaterTempC, 1.f - FMath::Exp(-Below / 3.f));
}

float UFishingWorldSubsystem::GetPressureActivityFactor(float Sensitivity) const
{
	const float Change = FMath::Clamp(FMath::Abs(PressureTrendHpaPerHour) / 2.f, 0.f, 1.f);
	// Низкое давление (< 1000) слегка угнетает, нормальное — идеально
	const float LowPenalty = FMath::Clamp((1005.f - PressureHpa) / 25.f, 0.f, 1.f);
	return FMath::Clamp(1.f - Sensitivity * (0.6f * Change + 0.3f * LowPenalty), 0.15f, 1.f);
}

FText UFishingWorldSubsystem::GetWeatherText(EFishingWeather InWeather)
{
	switch (InWeather)
	{
	case EFishingWeather::Clear:	return NSLOCTEXT("Fishing", "WeatherClear", "Ясно");
	case EFishingWeather::Cloudy:	return NSLOCTEXT("Fishing", "WeatherCloudy", "Переменная облачность");
	case EFishingWeather::Overcast:	return NSLOCTEXT("Fishing", "WeatherOvercast", "Пасмурно");
	case EFishingWeather::Rain:		return NSLOCTEXT("Fishing", "WeatherRain", "Дождь");
	case EFishingWeather::Storm:	return NSLOCTEXT("Fishing", "WeatherStorm", "Гроза");
	case EFishingWeather::Fog:		return NSLOCTEXT("Fishing", "WeatherFog", "Туман");
	default:						return FText::GetEmpty();
	}
}

void UFishingWorldSubsystem::RegisterZone(AFishingZone* Zone)
{
	if (Zone)
	{
		Zones.AddUnique(Zone);
	}
}

void UFishingWorldSubsystem::UnregisterZone(AFishingZone* Zone)
{
	Zones.Remove(Zone);
}

AFishingZone* UFishingWorldSubsystem::FindZoneAt(const FVector& WorldLocation) const
{
	for (const TWeakObjectPtr<AFishingZone>& WeakZone : Zones)
	{
		AFishingZone* Zone = WeakZone.Get();
		if (Zone && Zone->ContainsXY(WorldLocation))
		{
			return Zone;
		}
	}
	return nullptr;
}
