import {
    Im,
    ImPluginExtensionPoint,
    INotificationToastServiceDef,
    ISingleTargetCommand,
    ITextMenuItem,
    TargetItem,
} from "im-plugins-core";
import { ApiDto, IObjectCompositionDto, FileTypes } from "im-plugins-core/webapi/1.0";
import * as XLSX from "xlsx";

/**
Сбор ID версий дочерних объектов.

 */
async function getAllChildrenVersionIds(objectId: number): Promise<number[]> {
    const objectsClient = Im.Api.createClient(Im.Api.v1.Clients.ObjectsClient);
    const composition: ApiDto<IObjectCompositionDto>[] =
        await objectsClient.getObjectComposition(objectId);
    if (!composition || composition.length === 0) return [];

    const childVersionIds: number[] = [];
    for (const entry of composition) {
        const childId = entry.object?.objectID;
        if (childId !== undefined) {
            childVersionIds.push(childId);
            const nestedIds = await getAllChildrenVersionIds(childId);
            childVersionIds.push(...nestedIds);
        }
    }
    return childVersionIds;
}

const summaryBomCommand: ISingleTargetCommand<TargetItem> = {
    header: { id: "create_summary_bom" },


    execute: async ({ data }) => {
        const { objectId } = data;
        if (!objectId) return;

        const toast = Im.Ioc.get(INotificationToastServiceDef);

        try {
            const metadataHelper = Im.Helpers.metadataHelper;
            const numberAttrId = metadataHelper.getAttributeTypeId(
                "caf03200-de1e-41f7-8c7e-3469367237aa"
            );
            const objectAttributesClient = Im.Api.createClient(
                Im.Api.v1.Clients.ObjectAttributesClient
            );
            let orderNumber = "без номера";
            try {
                const numberValue = await objectAttributesClient.getAttributeValueAsString(
                    objectId,
                    numberAttrId,
                    false
                );
                if (numberValue) {
                    orderNumber = numberValue;
                }
            } catch {
                // остаётся "без номера"
            }


            const allChildrenIds = await getAllChildrenVersionIds(objectId);
            if (allChildrenIds.length === 0) {
                toast.addInfoToast("У объекта нет вложенных объектов.");
                return;
            }

            // Сбор имен файлов из объектов
            const filesClient = Im.Api.createClient(Im.Api.v1.Clients.FilesClient);
            const fileInfos: { index: number; name: string }[] = [];
            let globalIndex = 0;

            await Promise.all(
                allChildrenIds.map(async (childId) => {
                    try {
                        const fileAttrs = await filesClient.getFileAttributes(childId);
                        const files = fileAttrs.attributes?.[0]?.fileInfoCollection || [];
                        files.forEach((fi) => {
                            globalIndex++;
                            fileInfos.push({ index: globalIndex, name: fi.fileName });
                        });
                    } catch {
                        // игнорируем ошибки для отдельных объектов
                    }
                })
            );

            if (fileInfos.length === 0) {
                toast.addInfoToast(
                    "У вложенных объектов нет прикреплённых файлов. Будет создан пустой отчёт."
                );
            } else {
                toast.addInfoToast(`Найдено файлов: ${fileInfos.length}.`);
            }


            const sheetData = [["Номер", "Наименование файла"]];
            for (const fi of fileInfos) {
                sheetData.push([fi.index.toString(), fi.name]);
            }

            const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
            worksheet["!cols"] = [
                { wch: 8 },   // Номер
                { wch: 60 },  // Наименование файла
            ];

            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Сводная ведомость");
            const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });

            const blob = new Blob([excelBuffer], {
                type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            });


            const fileAttributeGuid = "cad0004b-306c-11d8-b4e9-00304f19f545";
            const fileAttributeId = metadataHelper.getAttributeTypeId(fileAttributeGuid);

            const fileName = `Сводная ведомость № ${orderNumber}.xlsx`;
            const fileData = { data: blob, fileName: fileName };


            let blobIdToUpdate: number | undefined = undefined;
            try {
                const parentFileAttrs = await filesClient.getFileAttributes(objectId);
                const fileAttr = parentFileAttrs.attributes?.find(
                    (a) => a.attributeId === fileAttributeId
                );
                if (fileAttr && fileAttr.fileInfoCollection.length > 0) {
                    const firstFile = fileAttr.fileInfoCollection[0];
                    if (!firstFile.fileName || firstFile.fileName.trim() === "") {
                        blobIdToUpdate = firstFile.blobId;
                    }
                }
            } catch {
                // если не удалось проверить – добавим новый файл
            }

            if (blobIdToUpdate !== undefined) {
                // Перезапись пустого файла (writeIndex = 0)
                await filesClient.updateObjectFile(
                    objectId,
                    blob.size,
                    fileAttributeId,
                    blobIdToUpdate,
                    new Date(),
                    fileName,
                    fileData
                );
            } else {
                // Добавление нового файла (AddValue)
                await filesClient.addObjectFile(
                    objectId,
                    blob.size,
                    fileAttributeId,
                    new Date(),
                    FileTypes.FtNormal,
                    fileName,
                    fileData
                );
            }

            toast.addInfoToast(`Сводная ведомость успешно сохранена в атрибуте «Файл».`);
        } catch (error) {
            console.error(error);
            toast.addErrorToast("Ошибка при формировании сводной ведомости");
        }


    },
    // Проверка типа объекта для показа пунка контекстного меню
    isSupport: ({ data }) => {
        return data.objectTypeGuid === "caf03200-9e9a-49d8-ad91-811cfe76f6ac";
    },

};

// Пункт контекстного меню и точка расширения
const summaryBomMenuItem: ITextMenuItem = {
    commandId: "create_summary_bom",
    item: {
        id: "createSummaryBom",
        text: "Создать сводную ведомость",
        order: 1500,
    },
};

export const summaryBomExtensionPoint: ImPluginExtensionPoint = {
    commands: {
        singleTargetCommand: summaryBomCommand,
    },
    contextMenu: {
        item: summaryBomMenuItem,
    },
};
