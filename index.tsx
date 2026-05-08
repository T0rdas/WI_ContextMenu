import { Im } from "im-plugins-core";
import { summaryBomExtensionPoint } from "./Extensions/summaryBomCommand";

/*
Для отладки этого модуля нужно в IPS WebInterface открыть окно Настройка/Параметры IPS,
перейти в дереве к элементу Пользователи/Текущий пользователь/Отладка загружаемых модулей и
добавить url http://localhost:3091/bundle.js, включить флажок загрузки модуля и обновить
вкладку браузера по F5
*/

// Регистрируем пользовательский плагин.
Im.Plugins.register(() => {
  return {
    // Название плагина.
    name: "WI_ContextMenu",
    // Регистрируем все точки расширения, реализованные в плагине.
      extensions: [summaryBomExtensionPoint],
  };
});
