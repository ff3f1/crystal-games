#include "Data/FishingCatalog.h"
#include "Data/TackleData.h"
#include "Data/FishSpeciesData.h"
#include "Data/LocationData.h"

UTackleItemData* UFishingCatalog::FindItem(FName InItemId) const
{
	for (UTackleItemData* Item : Items)
	{
		if (Item && Item->ItemId == InItemId)
		{
			return Item;
		}
	}
	return nullptr;
}

UFishSpeciesData* UFishingCatalog::FindSpecies(FName InSpeciesId) const
{
	for (UFishSpeciesData* Fish : Species)
	{
		if (Fish && Fish->SpeciesId == InSpeciesId)
		{
			return Fish;
		}
	}
	return nullptr;
}

ULocationData* UFishingCatalog::FindLocation(FName InLocationId) const
{
	for (ULocationData* Location : Locations)
	{
		if (Location && Location->LocationId == InLocationId)
		{
			return Location;
		}
	}
	return nullptr;
}
