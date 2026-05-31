When user navigates to setup, and analysis is already done, one gets redirected to analysis tab. This is currently janky however:
- when user opens a project, they get to setup, get shown a loading screen, and then get redirected as soon as data plops up. janky.
- instead, if analysis is ready, user should, on opening a project, get right away to analysis and see the loading screen there
- when user opens the setup page explicitly (e.g. by typing the url) no redirect should happen

So basically, i think redirect should only happen when the user is currently anayzing and in the moment it finishes.
When clicking onto a project in project hub, no redirect should happen, but one should get routed to setup or analysis based on if an analysis is ready right away