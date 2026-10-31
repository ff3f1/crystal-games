#include "Core/FishingSettings.h"
#include "Data/FishingCatalog.h"

UFishingSettings::UFishingSettings()
{
	// Путь, по которому Tools/create_sample_content.py создаёт каталог.
	Catalog = TSoftObjectPtr<UFishingCatalog>(FSoftObjectPath(TEXT("/Game/Data/DA_FishingCatalog.DA_FishingCatalog")));
}
