#pragma once

#include "CoreMinimal.h"
#include "GameFramework/HUD.h"
#include "FishingDebugHUD.generated.h"

/**
 * Простой HUD на Canvas, чтобы играть сразу, без UMG.
 * Потом замени на свои виджеты — все данные доступны через UFishingComponent / UFishingProfileSubsystem.
 */
UCLASS()
class FISHINGSIM_API AFishingDebugHUD : public AHUD
{
	GENERATED_BODY()

public:
	virtual void DrawHUD() override;

	/** Показывать вид/вес рыбы во время вываживания (для отладки баланса). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Fishing")
	bool bShowFishDebug = false;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Fishing")
	bool bShowControlsHelp = true;
};
