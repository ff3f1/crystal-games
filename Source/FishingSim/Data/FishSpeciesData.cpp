#include "Data/FishSpeciesData.h"

float UFishSpeciesData::GetActivityAtHour(float Hour) const
{
	const float H = FMath::Fmod(FMath::Fmod(Hour, 24.f) + 24.f, 24.f);
	const bool bNight = (H >= 22.f || H < 4.f);
	const float Base = bNight ? NightActivity : DayActivity;

	float Activity = Base;
	for (const FFeedingWindow& Window : FeedingWindows)
	{
		const float W = Window.GetWeight(H);
		if (W > 0.f)
		{
			Activity = FMath::Max(Activity, FMath::Lerp(Base, Window.Multiplier, W));
		}
	}
	return FMath::Max(0.f, Activity);
}

float UFishSpeciesData::GetTemperatureFactor(float WaterTempC) const
{
	const float Tol = FMath::Max(TempToleranceC, 0.5f);
	const float D = WaterTempC - OptimalWaterTempC;
	// Гаусс: в оптимуме 1, за пределами толерантности быстро падает, но не до нуля
	return FMath::Max(0.03f, FMath::Exp(-(D * D) / (2.f * Tol * Tol)));
}

float UFishSpeciesData::GetLureAffinity(ELureType Type) const
{
	if (const float* Value = LureAffinity.Find(Type))
	{
		return FMath::Max(0.f, *Value);
	}
	return 0.f;
}

float UFishSpeciesData::GetWeatherFactor(EFishingWeather InWeather) const
{
	if (const float* Value = WeatherActivity.Find(InWeather))
	{
		return FMath::Max(0.f, *Value);
	}
	return 1.f;
}

float UFishSpeciesData::GetDepthFactor(float InDepthM) const
{
	const float Outside = DepthM.DistanceOutside(InDepthM);
	return FMath::Exp(-Outside / 1.5f);
}

float UFishSpeciesData::GetWeightForLength(float InLengthCm) const
{
	const float L0 = FMath::Max(1.f, LengthCm.Min);
	const float L1 = FMath::Max(LengthCm.Max, L0 + 1.f);
	const float Alpha = (FMath::Cube(InLengthCm) - FMath::Cube(L0)) / (FMath::Cube(L1) - FMath::Cube(L0));
	return FMath::Max(0.005f, WeightKg.Min + (WeightKg.Max - WeightKg.Min) * Alpha);
}

bool UFishSpeciesData::IsHookSuitable(int32 HookSize) const
{
	return HookSize >= FMath::FloorToInt(HookSizeRange.Min) && HookSize <= FMath::CeilToInt(HookSizeRange.Max);
}
