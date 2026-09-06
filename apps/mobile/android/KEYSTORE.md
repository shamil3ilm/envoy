# Android Release Keystore

## Generating a keystore

Run once per release identity — keep the resulting `.jks` file and its passwords in a secure vault (1Password, Bitwarden, cloud KMS). If lost, the app can never be updated on Play Store under the same identity.

```
keytool -genkeypair -v \
  -storetype PKCS12 \
  -keystore envoy-release.jks \
  -alias envoy-upload \
  -keyalg RSA -keysize 4096 -validity 10000
```

## Wiring the keystore for local Gradle builds

1. Copy `envoy-release.jks` into `apps/mobile/android/app/`.
2. Create `apps/mobile/android/keystore.properties` (already gitignored):

```
storeFile=envoy-release.jks
storePassword=<the store password>
keyAlias=envoy-upload
keyPassword=<the key password>
```

3. Run the release build:

```
cd apps/mobile/android
./gradlew bundleRelease
```

## CI

In CI, do not commit the keystore. Instead:

- Store the base64-encoded keystore + passwords as encrypted CI secrets.
- Before the build step, decode the secret to `apps/mobile/android/app/envoy-release.jks` and write `apps/mobile/android/keystore.properties` from the other secrets.
- Never echo any of these values in build logs.

## Play Store upload signing

Enroll in Play App Signing (recommended). The upload key generated above only signs artifacts you upload; Google re-signs them with the app signing key it manages. This lets you recover from a lost upload key by contacting Play support.
