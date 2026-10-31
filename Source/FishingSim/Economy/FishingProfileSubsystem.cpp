#include "Economy/FishingProfileSubsystem.h"
#include "Economy/FishingSaveGame.h"
#include "Data/FishingCatalog.h"
#include "Data/FishSpeciesData.h"
#include "Data/LocationData.h"
#include "Core/FishingSettings.h"
#include "FishingSim.h"
#include "Engine/Engine.h"
#include "Engine/GameInstance.h"
#include "Engine/World.h"
#include "Kismet/GameplayStatics.h"

UFishingProfileSubsystem* UFishingProfileSubsystem::Get(const UObject* WorldContextObject)
{
	if (!GEngine || !WorldContextObject)
	{
		return nullptr;
	}
	const UWorld* World = GEngine->GetWorldFromContextObject(WorldContextObject, EGetWorldErrorMode::ReturnNull);
	UGameInstance* GI = World ? World->GetGameInstance() : nullptr;
	return GI ? GI->GetSubsystem<UFishingProfileSubsystem>() : nullptr;
}

void UFishingProfileSubsystem::Initialize(FSubsystemCollectionBase& Collection)
{
	Super::Initialize(Collection);

	const UFishingSettings* Settings = UFishingSettings::Get();
	Catalog = Settings->Catalog.LoadSynchronous();
	if (!Catalog)
	{
		UE_LOG(LogFishing, Warning,
			TEXT("Каталог не найден (%s). Запусти Tools/create_sample_content.py или укажи каталог в Project Settings -> Fishing Sim."),
			*Settings->Catalog.ToString());
	}

	if (UGameplayStatics::DoesSaveGameExist(Settings->SaveSlotName, 0))
	{
		Save = Cast<UFishingSaveGame>(UGameplayStatics::LoadGameFromSlot(Settings->SaveSlotName, 0));
	}
	if (!Save)
	{
		Save = Cast<UFishingSaveGame>(UGameplayStatics::CreateSaveGameObject(UFishingSaveGame::StaticClass()));
		GiveStarterKit();
		SaveProfile();
	}
	ValidateEquipped();
}

void UFishingProfileSubsystem::Deinitialize()
{
	SaveProfile();
	Super::Deinitialize();
}

void UFishingProfileSubsystem::GiveStarterKit()
{
	if (!Save || !Catalog)
	{
		return;
	}
	Save->SoftCurrency = Catalog->StarterSoftCurrency;
	for (const TPair<FName, int32>& Pair : Catalog->StarterItems)
	{
		Save->Items.FindOrAdd(Pair.Key) += Pair.Value;
	}
	for (const FName& EquipId : Catalog->StarterEquipped)
	{
		if (const UTackleItemData* Item = Catalog->FindItem(EquipId))
		{
			Save->Equipped.Add(Item->Slot, EquipId);
		}
	}
	for (const ULocationData* Location : Catalog->Locations)
	{
		if (Location && Location->IsFree())
		{
			Save->UnlockedLocations.Add(Location->LocationId);
		}
	}
}

void UFishingProfileSubsystem::SaveProfile()
{
	if (Save)
	{
		UGameplayStatics::SaveGameToSlot(Save, UFishingSettings::Get()->SaveSlotName, 0);
	}
}

void UFishingProfileSubsystem::ResetProfile()
{
	Save = Cast<UFishingSaveGame>(UGameplayStatics::CreateSaveGameObject(UFishingSaveGame::StaticClass()));
	GiveStarterKit();
	SaveProfile();
	OnCurrencyChanged.Broadcast();
	OnInventoryChanged.Broadcast();
	OnLoadoutChanged.Broadcast();
}

// ---------------- Валюта ----------------

int64 UFishingProfileSubsystem::GetSoftCurrency() const
{
	return Save ? Save->SoftCurrency : 0;
}

void UFishingProfileSubsystem::AddSoftCurrency(int64 Amount)
{
	if (Save && Amount != 0)
	{
		Save->SoftCurrency = FMath::Max<int64>(0, Save->SoftCurrency + Amount);
		OnCurrencyChanged.Broadcast();
	}
}

bool UFishingProfileSubsystem::SpendSoftCurrency(int64 Amount)
{
	if (!Save || Amount < 0 || Save->SoftCurrency < Amount)
	{
		return false;
	}
	Save->SoftCurrency -= Amount;
	OnCurrencyChanged.Broadcast();
	return true;
}

bool UFishingProfileSubsystem::IsPremiumAccountActive() const
{
	return PremiumUntil > FDateTime::UtcNow();
}

float UFishingProfileSubsystem::GetRewardMultiplier() const
{
	return IsPremiumAccountActive() ? 1.5f : 1.f;
}

// ---------------- Уровень ----------------

int32 UFishingProfileSubsystem::GetLevel() const
{
	return Save ? Save->Level : 1;
}

int32 UFishingProfileSubsystem::GetXp() const
{
	return Save ? Save->Xp : 0;
}

int32 UFishingProfileSubsystem::GetXpRequiredForLevel(int32 InLevel)
{
	return FMath::RoundToInt(100.f * FMath::Pow(static_cast<float>(FMath::Max(1, InLevel)), 1.6f));
}

void UFishingProfileSubsystem::AddXp(int32 Amount)
{
	if (!Save || Amount <= 0)
	{
		return;
	}
	Save->Xp += Amount;
	while (Save->Xp >= GetXpRequiredForLevel(Save->Level))
	{
		Save->Xp -= GetXpRequiredForLevel(Save->Level);
		++Save->Level;
		OnLevelUp.Broadcast(Save->Level);
	}
}

// ---------------- Предметы ----------------

int32 UFishingProfileSubsystem::GetItemCount(FName ItemId) const
{
	int32 Count = 0;
	if (Save)
	{
		if (const int32* Found = Save->Items.Find(ItemId))
		{
			Count = *Found;
		}
	}
	// Купленное навсегда за золото — всегда есть хотя бы 1
	if (Entitlements.Contains(ItemId))
	{
		Count = FMath::Max(Count, 1);
	}
	return Count;
}

bool UFishingProfileSubsystem::IsItemBroken(FName ItemId) const
{
	return Save && Save->BrokenItems.Contains(ItemId);
}

bool UFishingProfileSubsystem::IsItemUsable(FName ItemId) const
{
	return GetItemCount(ItemId) > 0 && !IsItemBroken(ItemId);
}

void UFishingProfileSubsystem::AddItem(FName ItemId, int32 Count)
{
	if (!Save || ItemId.IsNone() || Count <= 0)
	{
		return;
	}
	Save->Items.FindOrAdd(ItemId) += Count;

	// Если слот пуст — сразу надеваем
	if (Catalog)
	{
		if (const UTackleItemData* Item = Catalog->FindItem(ItemId))
		{
			if (!Save->Equipped.Contains(Item->Slot))
			{
				Save->Equipped.Add(Item->Slot, ItemId);
				OnLoadoutChanged.Broadcast();
			}
		}
	}
	OnInventoryChanged.Broadcast();
}

bool UFishingProfileSubsystem::ConsumeItem(FName ItemId, int32 Count)
{
	if (!Save || Entitlements.Contains(ItemId))
	{
		return true; // вечные предметы не расходуются
	}
	int32* Found = Save->Items.Find(ItemId);
	if (!Found || *Found < Count)
	{
		return false;
	}
	*Found -= Count;
	if (*Found <= 0)
	{
		Save->Items.Remove(ItemId);
		ValidateEquipped();
		OnLoadoutChanged.Broadcast();
	}
	OnInventoryChanged.Broadcast();
	SaveProfile();
	return true;
}

void UFishingProfileSubsystem::MarkItemBroken(FName ItemId)
{
	if (Save)
	{
		Save->BrokenItems.Add(ItemId);
		OnInventoryChanged.Broadcast();
		OnLoadoutChanged.Broadcast();
		SaveProfile();
	}
}

int32 UFishingProfileSubsystem::GetRepairCost(FName ItemId) const
{
	const UTackleItemData* Item = Catalog ? Catalog->FindItem(ItemId) : nullptr;
	if (!Item)
	{
		return 0;
	}
	// Премиум-вещи чинятся за серебро по «условной» цене (золото * 10)
	const int32 BasePrice = Item->PriceSoft > 0 ? Item->PriceSoft : Item->PricePremium * 10;
	return FMath::Max(10, FMath::RoundToInt(BasePrice * 0.3f));
}

EStorePurchaseResult UFishingProfileSubsystem::RepairItem(FName ItemId)
{
	if (!IsItemBroken(ItemId))
	{
		return EStorePurchaseResult::Failed;
	}
	if (!SpendSoftCurrency(GetRepairCost(ItemId)))
	{
		return EStorePurchaseResult::NotEnoughCurrency;
	}
	Save->BrokenItems.Remove(ItemId);
	OnInventoryChanged.Broadcast();
	OnLoadoutChanged.Broadcast();
	SaveProfile();
	return EStorePurchaseResult::Success;
}

TArray<UTackleItemData*> UFishingProfileSubsystem::GetOwnedItems(ETackleSlot Slot) const
{
	TArray<UTackleItemData*> Result;
	if (Catalog)
	{
		for (UTackleItemData* Item : Catalog->Items)
		{
			if (Item && Item->Slot == Slot && GetItemCount(Item->ItemId) > 0)
			{
				Result.Add(Item);
			}
		}
	}
	return Result;
}

bool UFishingProfileSubsystem::EquipItem(FName ItemId)
{
	const UTackleItemData* Item = Catalog ? Catalog->FindItem(ItemId) : nullptr;
	if (!Save || !Item || !IsItemUsable(ItemId))
	{
		return false;
	}
	Save->Equipped.Add(Item->Slot, ItemId);
	OnLoadoutChanged.Broadcast();
	SaveProfile();
	return true;
}

bool UFishingProfileSubsystem::EquipNextInSlot(ETackleSlot Slot)
{
	const TArray<UTackleItemData*> Owned = GetOwnedItems(Slot);
	if (Owned.Num() == 0 || !Save)
	{
		return false;
	}
	const FName* Current = Save->Equipped.Find(Slot);
	int32 Index = 0;
	if (Current)
	{
		for (int32 i = 0; i < Owned.Num(); ++i)
		{
			if (Owned[i]->ItemId == *Current)
			{
				Index = (i + 1) % Owned.Num();
				break;
			}
		}
	}
	return EquipItem(Owned[Index]->ItemId);
}

UTackleItemData* UFishingProfileSubsystem::GetEquippedItem(ETackleSlot Slot) const
{
	if (!Save || !Catalog)
	{
		return nullptr;
	}
	const FName* Id = Save->Equipped.Find(Slot);
	if (!Id || !IsItemUsable(*Id))
	{
		return nullptr;
	}
	return Catalog->FindItem(*Id);
}

FTackleLoadout UFishingProfileSubsystem::BuildEquippedLoadout() const
{
	FTackleLoadout Result;
	Result.Rod = Cast<URodData>(GetEquippedItem(ETackleSlot::Rod));
	Result.Reel = Cast<UReelData>(GetEquippedItem(ETackleSlot::Reel));
	Result.Line = Cast<ULineData>(GetEquippedItem(ETackleSlot::Line));
	Result.Hook = Cast<UHookData>(GetEquippedItem(ETackleSlot::Hook));
	Result.Bait = Cast<UBaitData>(GetEquippedItem(ETackleSlot::Bait));
	return Result;
}

void UFishingProfileSubsystem::ValidateEquipped()
{
	if (!Save)
	{
		return;
	}
	// Закончившиеся предметы снимаем и пробуем надеть другой подходящий
	TArray<ETackleSlot> Slots;
	Save->Equipped.GetKeys(Slots);
	for (const ETackleSlot EquipSlot : Slots)
	{
		const FName Id = Save->Equipped.FindRef(EquipSlot);
		if (GetItemCount(Id) <= 0)
		{
			Save->Equipped.Remove(EquipSlot);
			const TArray<UTackleItemData*> Owned = GetOwnedItems(EquipSlot);
			if (Owned.Num() > 0)
			{
				Save->Equipped.Add(EquipSlot, Owned[0]->ItemId);
			}
		}
	}
}

// ---------------- Магазин ----------------

EStorePurchaseResult UFishingProfileSubsystem::CanBuyWithSoft(FName ItemId) const
{
	const UTackleItemData* Item = Catalog ? Catalog->FindItem(ItemId) : nullptr;
	if (!Item)
	{
		return EStorePurchaseResult::UnknownItem;
	}
	if (!Item->CanBuyWithSoft())
	{
		return Item->bPremiumOnly ? EStorePurchaseResult::PremiumOnly : EStorePurchaseResult::NotForSale;
	}
	if (GetLevel() < Item->RequiredLevel)
	{
		return EStorePurchaseResult::LevelTooLow;
	}
	// Удилища/катушки/леску достаточно иметь в одном экземпляре
	const bool bSingle = Item->Slot == ETackleSlot::Rod || Item->Slot == ETackleSlot::Reel || Item->Slot == ETackleSlot::Line;
	if (bSingle && GetItemCount(ItemId) > 0)
	{
		return EStorePurchaseResult::AlreadyOwned;
	}
	if (GetSoftCurrency() < Item->PriceSoft)
	{
		return EStorePurchaseResult::NotEnoughCurrency;
	}
	return EStorePurchaseResult::Success;
}

EStorePurchaseResult UFishingProfileSubsystem::BuyWithSoft(FName ItemId)
{
	const EStorePurchaseResult Check = CanBuyWithSoft(ItemId);
	if (Check != EStorePurchaseResult::Success)
	{
		return Check;
	}
	const UTackleItemData* Item = Catalog->FindItem(ItemId);
	SpendSoftCurrency(Item->PriceSoft);
	AddItem(ItemId, Item->PurchaseQuantity);
	SaveProfile();
	return EStorePurchaseResult::Success;
}

// ---------------- Водоёмы ----------------

bool UFishingProfileSubsystem::IsLocationUnlocked(FName LocationId) const
{
	const ULocationData* Location = Catalog ? Catalog->FindLocation(LocationId) : nullptr;
	if (Location && Location->IsFree())
	{
		return true;
	}
	return Entitlements.Contains(LocationId) || (Save && Save->UnlockedLocations.Contains(LocationId));
}

EStorePurchaseResult UFishingProfileSubsystem::UnlockLocationWithSoft(FName LocationId)
{
	const ULocationData* Location = Catalog ? Catalog->FindLocation(LocationId) : nullptr;
	if (!Location || !Save)
	{
		return EStorePurchaseResult::UnknownItem;
	}
	if (IsLocationUnlocked(LocationId))
	{
		return EStorePurchaseResult::AlreadyOwned;
	}
	if (Location->bPremiumOnly || Location->PriceSoft <= 0)
	{
		return EStorePurchaseResult::PremiumOnly;
	}
	if (GetLevel() < Location->RequiredLevel)
	{
		return EStorePurchaseResult::LevelTooLow;
	}
	if (!SpendSoftCurrency(Location->PriceSoft))
	{
		return EStorePurchaseResult::NotEnoughCurrency;
	}
	Save->UnlockedLocations.Add(LocationId);
	OnInventoryChanged.Broadcast();
	SaveProfile();
	return EStorePurchaseResult::Success;
}

// ---------------- Улов ----------------

void UFishingProfileSubsystem::FillCatchValue(FCatchRecord& Catch) const
{
	const UFishSpeciesData* Species = Catalog ? Catalog->FindSpecies(Catch.SpeciesId) : nullptr;
	if (!Species)
	{
		return;
	}
	const float Mult = GetRewardMultiplier();
	const float TrophyMult = Catch.bTrophy ? 2.f : 1.f;
	Catch.SoftValue = FMath::RoundToInt(Species->PricePerKg * Catch.WeightKg * TrophyMult * Mult);
	Catch.Xp = FMath::RoundToInt((Species->XpBase + Species->XpPerKg * Catch.WeightKg) * TrophyMult * Mult);
}

void UFishingProfileSubsystem::RegisterCatch(const FCatchRecord& Catch, bool bKeepInNet)
{
	if (!Save)
	{
		return;
	}

	++Save->TotalCatches;
	Save->TotalWeightKg += Catch.WeightKg;

	// Отпущенная рыба даёт +25% опыта (поощряем «поймал-отпусти»)
	AddXp(bKeepInNet ? Catch.Xp : FMath::RoundToInt(Catch.Xp * 1.25f));

	if (bKeepInNet)
	{
		Save->Keepnet.Add(Catch);
	}

	bool bNewRecord = false;
	FCatchRecord& Record = Save->Records.FindOrAdd(Catch.SpeciesId);
	if (Catch.WeightKg > Record.WeightKg)
	{
		Record = Catch;
		bNewRecord = true;
	}

	OnCatchRegistered.Broadcast(Catch, bNewRecord);
	OnInventoryChanged.Broadcast();
	SaveProfile();
}

int64 UFishingProfileSubsystem::SellKeepnet()
{
	if (!Save || Save->Keepnet.Num() == 0)
	{
		return 0;
	}
	int64 Total = 0;
	for (const FCatchRecord& Catch : Save->Keepnet)
	{
		Total += Catch.SoftValue;
	}
	Save->Keepnet.Reset();
	AddSoftCurrency(Total);
	OnInventoryChanged.Broadcast();
	SaveProfile();
	return Total;
}

TArray<FCatchRecord> UFishingProfileSubsystem::GetKeepnet() const
{
	return Save ? Save->Keepnet : TArray<FCatchRecord>();
}

TArray<FCatchRecord> UFishingProfileSubsystem::GetRecords() const
{
	TArray<FCatchRecord> Result;
	if (Save)
	{
		Save->Records.GenerateValueArray(Result);
	}
	return Result;
}

int32 UFishingProfileSubsystem::GetTotalCatches() const
{
	return Save ? Save->TotalCatches : 0;
}

// ---------------- Сервер ----------------

void UFishingProfileSubsystem::ApplyServerState(int64 InPremiumCurrency, const TArray<FName>& InEntitlements, const FDateTime& InPremiumUntil)
{
	PremiumCurrency = FMath::Max<int64>(0, InPremiumCurrency);
	Entitlements.Reset();
	Entitlements.Append(InEntitlements);
	PremiumUntil = InPremiumUntil;

	// Вечные покупки сразу надеваются, если слот пуст
	if (Save && Catalog)
	{
		for (const FName& Id : Entitlements)
		{
			if (const UTackleItemData* Item = Catalog->FindItem(Id))
			{
				if (!Save->Equipped.Contains(Item->Slot))
				{
					Save->Equipped.Add(Item->Slot, Id);
				}
			}
		}
	}

	OnCurrencyChanged.Broadcast();
	OnInventoryChanged.Broadcast();
	OnLoadoutChanged.Broadcast();
}

bool UFishingProfileSubsystem::ApplyGrant(const FString& GrantId, FName ItemId, int32 Count)
{
	if (!Save || GrantId.IsEmpty() || Save->ProcessedGrantIds.Contains(GrantId))
	{
		return false;
	}
	Save->ProcessedGrantIds.Add(GrantId);

	if (Catalog && Catalog->FindLocation(ItemId))
	{
		Save->UnlockedLocations.Add(ItemId);
		OnInventoryChanged.Broadcast();
	}
	else
	{
		AddItem(ItemId, Count);
	}
	SaveProfile();
	return true;
}
