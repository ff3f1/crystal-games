#pragma once

#include "CoreMinimal.h"
#include "Engine/DeveloperSettings.h"
#include "FishingSettings.generated.h"

class UFishingCatalog;

/**
 * Настройки игры: Project Settings -> Game -> Fishing Sim.
 * Сохраняются в Config/DefaultGame.ini.
 */
UCLASS(Config = Game, DefaultConfig, meta = (DisplayName = "Fishing Sim"))
class FISHINGSIM_API UFishingSettings : public UDeveloperSettings
{
	GENERATED_BODY()

public:
	UFishingSettings();

	static const UFishingSettings* Get() { return GetDefault<UFishingSettings>(); }

	/** Каталог всех рыб, снастей и локаций. */
	UPROPERTY(Config, EditAnywhere, Category = "Data")
	TSoftObjectPtr<UFishingCatalog> Catalog;

	/** Базовая частота поклёвок (поклёвок/сек при суммарной «привлекательности» = 1). */
	UPROPERTY(Config, EditAnywhere, Category = "Gameplay", meta = (ClampMin = "0"))
	float GlobalBiteRate = 0.015f;

	/** Сколько реальных минут длятся игровые сутки. */
	UPROPERTY(Config, EditAnywhere, Category = "Gameplay", meta = (ClampMin = "1"))
	float RealMinutesPerGameDay = 48.f;

	/** Час, с которого начинается игра. */
	UPROPERTY(Config, EditAnywhere, Category = "Gameplay", meta = (ClampMin = "0", ClampMax = "24"))
	float StartHour = 5.5f;

	/** Сезонная температура воды у поверхности (°C). */
	UPROPERTY(Config, EditAnywhere, Category = "Gameplay")
	float SeasonSurfaceWaterTempC = 19.f;

	UPROPERTY(Config, EditAnywhere, Category = "Save")
	FString SaveSlotName = TEXT("FishingProfile");

	/** Адрес твоего игрового сервера (Backend/server.js). */
	UPROPERTY(Config, EditAnywhere, Category = "Store")
	FString BackendBaseUrl = TEXT("http://localhost:8080");

	/**
	 * Режим разработки: магазин работает локально без сервера (золото «покупается» бесплатно).
	 * В Shipping-сборке игнорируется — там всегда работает сервер.
	 */
	UPROPERTY(Config, EditAnywhere, Category = "Store")
	bool bOfflineDevStore = true;

	/**
	 * Какие параметры командной строки от лаунчера VK Play отправлять на сервер для авторизации.
	 * Пусто = отправлять все параметры вида -key=value. Точные имена — в документации VK Play.
	 */
	UPROPERTY(Config, EditAnywhere, Category = "Store")
	TArray<FString> LauncherParamWhitelist;

	UPROPERTY(Config, EditAnywhere, Category = "Store", meta = (ClampMin = "1"))
	float OrderPollIntervalSec = 3.f;

	UPROPERTY(Config, EditAnywhere, Category = "Store", meta = (ClampMin = "10"))
	float OrderPollTimeoutSec = 900.f;
};
