#include "Player/FishingGameMode.h"
#include "Player/FishingCharacter.h"
#include "Player/FishingDebugHUD.h"

AFishingGameMode::AFishingGameMode()
{
	DefaultPawnClass = AFishingCharacter::StaticClass();
	HUDClass = AFishingDebugHUD::StaticClass();
}
