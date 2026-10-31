#include "Fishing/FishBiteModel.h"
#include "Data/FishSpeciesData.h"
#include "Data/TackleData.h"
#include "Data/FishingCatalog.h"
#include "World/FishingZone.h"
#include "World/FishingWorldSubsystem.h"

float FFishBiteModel::ScoreSpecies(const FBiteContext& Ctx, const UFishSpeciesData* Species, float Abundance)
{
	const UFishSpeciesData* S = Species;
	if (!S || !Ctx.Bait || !Ctx.Hook || !Ctx.Line || Abundance <= 0.f)
	{
		return 0.f;
	}

	float Score = Abundance * S->Commonness;

	// --- Наживка / приманка ---
	const float Affinity = S->GetLureAffinity(Ctx.Bait->LureType);
	if (Affinity <= 0.f)
	{
		return 0.f; // на это не берёт вообще
	}
	Score *= Affinity * Ctx.Bait->Attraction;
	if (S->FavoriteBaits.Contains(Ctx.Bait->ItemId))
	{
		Score *= 1.5f;
	}

	// --- Проводка ---
	if (Ctx.Bait->IsArtificial())
	{
		if (Ctx.LureSpeedMps < 0.05f)
		{
			Score *= 0.08f; // стоящая блесна почти не работает
		}
		else
		{
			const float Off = Ctx.Bait->OptimalRetrieveSpeedMps.DistanceOutside(Ctx.LureSpeedMps);
			Score *= FMath::Exp(-Off / 0.35f);
		}
	}
	else if (Ctx.LureSpeedMps > 0.5f)
	{
		Score *= 0.35f; // натуральную наживку быстро тащат — рыба не успевает
	}

	// --- Глубина ---
	Score *= S->GetDepthFactor(Ctx.LureDepthM);
	// Донная рыба охотнее берёт с самого дна
	if (Ctx.bOnBottom && S->DepthM.Max >= Ctx.BottomDepthM - 0.5f && !S->bPredator)
	{
		Score *= 1.2f;
	}

	// --- Температура / время / погода / давление ---
	if (Ctx.Env)
	{
		Score *= S->GetTemperatureFactor(Ctx.Env->GetWaterTemperatureAt(Ctx.LureDepthM));
		Score *= S->GetActivityAtHour(Ctx.Env->TimeOfDayHours);
		Score *= S->GetWeatherFactor(Ctx.Env->Weather);
		Score *= Ctx.Env->GetPressureActivityFactor(S->PressureSensitivity);
	}

	// --- Крючок ---
	if (!S->IsHookSuitable(Ctx.Hook->HookSize))
	{
		Score *= 0.25f;
	}

	// --- Леска и поводок ---
	const float Clarity = Ctx.Zone ? Ctx.Zone->WaterClarity : 0.5f;
	const float LineVisibility = Ctx.Line->Visibility * FMath::Clamp(Ctx.Line->DiameterMm / 0.25f, 0.3f, 2.5f);
	float Shyness = S->LineShyness * LineVisibility * (0.4f + Clarity);
	if (Ctx.Hook->bWireLeader && !S->bPredator)
	{
		Shyness += 0.5f * S->LineShyness;
	}
	Score *= FMath::Clamp(1.f - 0.6f * Shyness, 0.08f, 1.f);

	// --- Дно ---
	if (Ctx.Zone && S->PreferredBottoms.Num() > 0)
	{
		Score *= S->PreferredBottoms.Contains(Ctx.Zone->BottomType) ? 1.25f : 0.7f;
	}

	return FMath::Max(0.f, Score);
}

float FFishBiteModel::GatherCandidates(const FBiteContext& Ctx, TArray<FBiteCandidate>& OutCandidates)
{
	OutCandidates.Reset();
	float Total = 0.f;

	auto AddCandidate = [&](UFishSpeciesData* Species, float Abundance, float SizeBias)
	{
		const float Score = ScoreSpecies(Ctx, Species, Abundance);
		if (Score > UE_KINDA_SMALL_NUMBER)
		{
			FBiteCandidate& Candidate = OutCandidates.AddDefaulted_GetRef();
			Candidate.Species = Species;
			Candidate.Score = Score;
			Candidate.SizeBias = SizeBias;
			Total += Score;
		}
	};

	if (Ctx.Zone && Ctx.Zone->Fish.Num() > 0)
	{
		for (const FZoneFishEntry& Entry : Ctx.Zone->Fish)
		{
			AddCandidate(Entry.Species.Get(), Entry.Abundance, Entry.SizeBias);
		}
	}
	else if (Ctx.Catalog)
	{
		for (UFishSpeciesData* Species : Ctx.Catalog->Species)
		{
			AddCandidate(Species, 1.f, 1.f);
		}
	}
	return Total;
}

float FFishBiteModel::GetBiteRatePerSecond(const FBiteContext& Ctx, float TotalScore)
{
	float Rate = Ctx.GlobalBiteRate * TotalScore;
	if (Ctx.Zone)
	{
		Rate *= Ctx.Zone->FishDensity * Ctx.Zone->GetPressureFactor();
	}
	return FMath::Clamp(Rate, 0.f, 0.5f);
}

const FBiteCandidate* FFishBiteModel::PickCandidate(const TArray<FBiteCandidate>& Candidates, float TotalScore)
{
	if (Candidates.Num() == 0 || TotalScore <= 0.f)
	{
		return nullptr;
	}
	float Roll = FMath::FRand() * TotalScore;
	for (const FBiteCandidate& Candidate : Candidates)
	{
		Roll -= Candidate.Score;
		if (Roll <= 0.f)
		{
			return &Candidate;
		}
	}
	return &Candidates.Last();
}

void FFishBiteModel::RollFishSize(const UFishSpeciesData& Species, const UBaitData* Bait, float SizeBias,
	float& OutLengthCm, float& OutWeightKg, bool& bOutTrophy)
{
	const float Selectivity = Bait ? Bait->SizeSelectivity : 1.f;
	// Большой перекос = в основном мелочь; крупная приманка и «трофейная» зона сдвигают к крупной
	const float Skew = FMath::Max(0.3f, Species.SizeSkew / FMath::Max(0.2f, SizeBias * Selectivity));
	float Length = Species.LengthCm.Lerp(FMath::Pow(FMath::FRand(), Skew));

	bOutTrophy = false;
	if (FMath::FRand() < Species.TrophyChance * SizeBias * FMath::Max(1.f, Selectivity))
	{
		bOutTrophy = true;
		const float MaxTrophy = Species.LengthCm.Max * Species.TrophyLengthFactor;
		Length = FMath::Lerp(Species.LengthCm.Max, MaxTrophy, FMath::Pow(FMath::FRand(), 1.5f));
	}

	// Индивидуальная упитанность ±10%
	const float Condition = FMath::FRandRange(0.9f, 1.1f);
	OutLengthCm = FMath::RoundToFloat(Length * 10.f) / 10.f;
	OutWeightKg = FMath::RoundToFloat(Species.GetWeightForLength(Length) * Condition * 1000.f) / 1000.f;
}
