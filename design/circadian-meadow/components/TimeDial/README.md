# TimeDial

Hour-of-day slider whose track is the day's horizon, from night through dawn, day, golden hour, sunset and twilight.

Provide `value`/`onChange` (or `defaultValue`), and `onLiveChange` to show "Follow my clock". Pass the hour to the scene components (`hour` prop); they blend the six keyframes of scene tokens the same way the garden does. The dial itself never sets the page colour; whoever owns the hour sets `data-theme` from `Meadow.pageFor(hour)`. On the site "Follow my clock" is on by default.

The readout is 24-hour `HH:MM` in tabular figures, and the phase name sits beside it in italic display type.
