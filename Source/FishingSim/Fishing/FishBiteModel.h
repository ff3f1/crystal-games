#pragma once

#include "CoreMinimal.h"

class AFishingZone;
class UFishingWorldSubsystem;
class UFishSpeciesData;
class UFishingCatalog;
class URodData;
class ULineData;
class UHookData;
class UBaitData;
struct FZoneFishEntry;

/** Всё, что влияет на клёв в данный момент. */
struct FBiteContext
{
	const AFishingZone* Zone = nullptr;
	const UFishingWorldSubsystem* Env = nullptr;
	const UFishingCatalog* Catalog = nullptr;	// если в зоне не задан список рыб
	const URodData* Rod = nullptr;
	const ULineData* Line = nullptr;
	const UHookData* Hook = nullptr;
	const UBaitData* Bait = nullptr;
	float LureDepthM = 0.f;
	float BottomDepthM = 0.f;
	float LureSpeedMps = 0.f;
	bool bOnBottom = false;
	float GlobalBiteRate = 0.015f;
};

struct FBiteCandidate
{
	UFishSpeciesData* Species = nullptr;
	float Score = 0.f;
	float SizeBias = 1.f;
};

/**
 * Модель клёва. Для каждого вида считается «привлекательность» снасти в текущих условиях:
 * численность * наживка * проводка * глубина * температура воды * время суток * погода * давление
 * * крючок * заметность лески * тип дна. Сумма даёт частоту поклёвок, вид выбирается взвешенно.
 */
class FISHINGSIM_API FFishBiteModel
{
public:
	static float ScoreSpecies(const FBiteContext& Ctx, const UFishSpeciesData* Species, float Abundance);

	/** Возвращает суммарный счёт. */
	static float GatherCandidates(const FBiteContext& Ctx, TArray<FBiteCandidate>& OutCandidates);

	static float GetBiteRatePerSecond(const FBiteContext& Ctx, float TotalScore);

	static const FBiteCandidate* PickCandidate(const TArray<FBiteCandidate>& Candidates, float TotalScore);

	static void RollFishSize(const UFishSpeciesData& Species, const UBaitData* Bait, float SizeBias,
		float& OutLengthCm, float& OutWeightKg, bool& bOutTrophy);
};
