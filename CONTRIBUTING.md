# Contributing

## Before opening a change

1. Describe the user problem and the evidence that it exists.
2. Add or update a failing test before changing behavior.
3. Do not add generated scores, adoption claims or user quotes without a
   reproducible source.
4. Keep the no-model rules path operational.

## Verification

```powershell
cd backend
py -3.12 -m pytest -q

cd ..\frontend
npm test -- --run
npm run build
```

Pull requests should include screenshots for interface changes and the exact
benchmark command for analyzer changes.
