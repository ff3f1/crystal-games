#pragma once

#include "CoreMinimal.h"
#include "GameFramework/GameModeBase.h"
#include "FishingGameMode.generated.h"

/** Режим игры: рыбак + отладочный HUD. В World Settings уровня укажи GameMode Override = FishingGameMode. */
UCLASS()
class FISHINGSIM_API AFishingGameMode : public AGameModeBase
{
	GENERATED_BODY()

public:
	AFishingGameMode();
};
