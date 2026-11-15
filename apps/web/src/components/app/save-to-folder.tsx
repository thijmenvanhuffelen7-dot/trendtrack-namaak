"use client";

import { BookMarked } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { saveToFolderAction, type SaveState } from "@/app/app/actions";
import { LimitInline } from "@/components/app/limit-inline";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";

export interface FolderOption {
  id: string;
  name: string;
}

/** "Opslaan in folder": kies een bestaande folder of maak er direct een nieuwe. */
export function SaveToFolder({
  itemType,
  itemId,
  folders,
}: {
  itemType: "ad" | "shop" | "email";
  itemId: string;
  folders: FolderOption[];
}) {
  const t = useTranslations("shop");
  const [state, action, pending] = useActionState<SaveState, FormData>(saveToFolderAction, {
    status: "idle",
  });
  const [choice, setChoice] = useState(folders[0]?.id ?? "new");
  const uid = `${itemType}-${itemId}`;

  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="item_type" value={itemType} />
      <input type="hidden" name="item_id" value={itemId} />
      <label htmlFor={`folder-${uid}`} className="sr-only">
        {t("chooseFolder")}
      </label>
      <Select
        id={`folder-${uid}`}
        name="folder_id"
        value={choice}
        onChange={(e) => setChoice(e.target.value)}
        className="w-44"
      >
        {folders.map((f) => (
          <option key={f.id} value={f.id}>
            {f.name}
          </option>
        ))}
        <option value="new">{t("newFolder")}</option>
      </Select>
      {choice === "new" && (
        <Input
          name="new_name"
          required
          maxLength={80}
          placeholder={t("newFolderName")}
          aria-label={t("newFolderName")}
          className="w-48"
        />
      )}
      <Button type="submit" variant="outline" disabled={pending}>
        <BookMarked className="size-4" aria-hidden />
        {t("saveToFolder")}
      </Button>
      <span role="status" className="text-sm text-muted-foreground">
        {state.status === "saved" && `${t("saved")}: ${state.folderName}`}
        {state.status === "error" && "✕"}
      </span>
      {state.status === "limit" && state.message && <LimitInline message={state.message} />}
    </form>
  );
}
