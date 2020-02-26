# Ratify
A cli tool that helps you keep on top of your composer package versions!

## Installation
`npm install -g @kregel/dependency`

## How to use
Go to your PHP project's source code in your terminal.
```
cd src/php-exception-probe
```

Then just run the command `dependency-check`. It will automatically find your composer.json/.lock files, parse them and in a few seconds a table of packages will be spat out.

# Extras
Pull requests, and issues are welcome! This could totally be expanded to support other package managers, but for now, for MVP just composer.
