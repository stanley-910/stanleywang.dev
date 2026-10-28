# ControlPanel

The floating settings box: time, wind, text, regrow and hide. It is the only filled box in the system.

Provide callbacks: `onHour(hour)`, `onWind`, `onText`, `onPage(theme)`, `onRegrow`, `onHide`. Whenever the hour changes, `onPage` gets the page theme for it (`dark` or `light`, from `Meadow.pageFor`); set it as `data-theme` on `<html>`. There is no separate page toggle: the page follows the sky, so the Time slider is the light/dark control. Without an `hour` prop the panel follows the viewer's clock ("Follow my clock" on) until the time is moved. Place the panel top left, inset `space-3`, filled with `control` and a 6px backdrop blur, and hide it on `H`. It never sits over the bio.
