const { defineConfig } = require('electron-builder')

module.exports = defineConfig({
  appId: 'com.nuxscp.app',
  productName: 'NuxSCP',
  copyright: 'Copyright © 2024',
  directories: {
    output: 'release',
    buildResources: 'resources'
  },
  files: [
    'dist/**/*',
    'resources/**/*'
  ],
  mac: {
    target: [
      { target: 'dmg', arch: ['x64', 'arm64'] }
    ],
    category: 'public.app-category.developer-tools',
    icon: 'resources/icon.icns'
  },
  linux: {
    target: [
      { target: 'AppImage', arch: ['x64'] },
      { target: 'deb', arch: ['x64'] }
    ],
    category: 'Network',
    icon: 'resources/icon.png'
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true
  }
})
