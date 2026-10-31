#pragma once

#include "CoreMinimal.h"
#include "GameFramework/SaveGame.h"
#include "Core/FishingTypes.h"
#include "FishingSaveGame.generated.h"

/**
 * Локальное сохранение. ВАЖНО: премиум-валюта и покупки за реальные деньги здесь НЕ хранятся —
 * их источник истины сервер (Backend). Иначе их легко «нарисовать» правкой файла.
 */
UCLASS()
class FISHINGSIM_API UFishingSaveGame : public USaveGame
{
	GENERATED_BODY()

public:
	UPROPERTY()
	int32 SaveVersion = 1;

	UPROPERTY()
	int64 SoftCurrency = 0;

	UPROPERTY()
	int32 Level = 1;

	UPROPERTY()
	int32 Xp = 0;

	/** ItemId -> количество. */
	UPROPERTY()
	TMap<FName, int32> Items;

	UPROPERTY()
	TMap<ETackleSlot, FName> Equipped;

	/** Сломанные предметы (нужен ремонт). */
	UPROPERTY()
	TSet<FName> BrokenItems;

	UPROPERTY()
	TSet<FName> UnlockedLocations;

	/** Садок: рыба, которую можно продать. */
	UPROPERTY()
	TArray<FCatchRecord> Keepnet;

	/** Личные рекорды: SpeciesId -> самый тяжёлый экземпляр. */
	UPROPERTY()
	TMap<FName, FCatchRecord> Records;

	UPROPERTY()
	int32 TotalCatches = 0;

	UPROPERTY()
	float TotalWeightKg = 0.f;

	/** Уже применённые серверные выдачи (защита от двойного начисления). */
	UPROPERTY()
	TSet<FString> ProcessedGrantIds;

	// --- Только для офлайн-режима разработки (bOfflineDevStore) ---
	UPROPERTY()
	int64 DevPremiumCurrency = 0;

	UPROPERTY()
	FDateTime DevPremiumUntil;

	UPROPERTY()
	TArray<FName> DevEntitlements;
};
