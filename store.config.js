// App Store Connect + Google Play metadata
// Used by `eas metadata:push` to sync store listings automatically

module.exports = {
  configVersion: 0,
  apple: {
    info: {
      'en-US': {
        title: 'BlindAid',
        subtitle: 'Navigate. Explore. Stay Safe.',
        description: `BlindAid is a free navigation and environmental awareness app for blind and visually impaired people, built by NeuroShine — a 501(c)(3) assistive technology nonprofit.

No special hardware required. Works on any modern iPhone. Experience quality scales automatically with your device's capabilities.

WHAT IT DOES
• Describes everything around you in plain, conversational English using AI vision
• Provides turn-by-turn walking directions with landmark callouts
• Detects obstacles ahead, to your sides, and at head level — always running in the background
• Alerts your emergency contacts instantly with your live location if you need help
• Connects to the optional BlindAid Vest for 360° spatial awareness and body haptics

AUDIO-FIRST DESIGN
Every feature is designed to be used without ever looking at the screen. Voice commands work at all times. Every action has audio and haptic confirmation. Onboarding is completable with your eyes fully closed.

DEVICE TIERS
Tier 1 — Any iPhone (2019 or newer): camera-based depth sensing, obstacle detection, full feature set
Tier 2 — iPhone 12 Pro and later: LiDAR sensor for precision depth at 30fps, low-light performance
Tier 3 — Any iPhone + BlindAid Vest: 360° awareness, body-mapped haptics, fall detection

THE BLINDAID VEST (OPTIONAL)
A $60–90 wearable with 10 haptic motors and 3 LiDAR sensors. Distributed free to qualifying users through NeuroShine's grant program. Connects via Bluetooth. Looks like a standard athletic vest.

GUARDIAN ACCOUNT
Link a caregiver who can monitor your live location, receive emergency alerts, push voice messages to your app, and set safe zone notifications.

COMPLETELY FREE
No ads. No subscription. No paywall. Ever. NeuroShine is a nonprofit.

VoiceOver compatible. Designed with and tested by blind and visually impaired users.`,
        keywords: [
          'blind',
          'visually impaired',
          'accessibility',
          'navigation',
          'obstacle detection',
          'assistive technology',
          'voiceover',
          'low vision',
          'screen reader',
          'neuroshine',
        ],
        marketingUrl: 'https://neuroshine.org/blindaid',
        supportUrl: 'https://neuroshine.org/support',
        privacyPolicyUrl: 'https://neuroshine.org/privacy',
        releaseNotes: 'Initial release of BlindAid — audio-first navigation for blind and visually impaired users.',
      },
    },
    categories: {
      primary: 'MEDICAL',
      secondary: 'NAVIGATION',
    },
    review: {
      firstName: 'Satvik',
      lastName: 'Koya',
      phone: 'FILL_IN_PHONE',
      email: 'satvikkoya@gmail.com',
      notes:
        'BlindAid is an assistive technology app for blind and visually impaired users. All core features require audio output — the screen is intentionally minimal. Please test with VoiceOver enabled. Camera permission is used for real-time obstacle detection and AI scene description. Location permission is used for navigation and emergency broadcasts. Bluetooth is used to connect the optional BlindAid Vest peripheral.',
      demoUsername: '',
      demoPassword: '',
    },
    pricing: {
      price: 'FREE',
    },
  },
};
