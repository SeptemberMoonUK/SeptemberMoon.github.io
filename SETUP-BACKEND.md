# September Moon backend setup

The admin area is already built at **`/admin.html`**. The public catalogue works from the bundled seed data until Firebase is connected, so you can deploy these files without immediately breaking the shop.

## 1. Create a Firebase project

1. Open Firebase Console and create a project for September Moon.
2. Add a **Web app** to the project.
3. Copy the Firebase configuration object Firebase gives you.
4. Open `js/firebase-config.js` in this build and replace the `PASTE_...` values with the matching values from that configuration object.

Do not put service-account/private keys in this website. The normal Firebase web configuration is designed to be shipped to browsers; the `firestore.rules` and `storage.rules` files are what enforce admin access.

## 2. Enable Google sign-in

In Firebase Console:

1. Go to **Authentication**.
2. Open **Sign-in method**.
3. Enable **Google**.
4. Add `septembermoon.uk` to the Authentication **Authorized domains** list (and `www.septembermoon.uk` too if you use it).

After this, `/admin.html` will let you sign in with a Google account.

## 3. Create Firestore

1. In Firebase Console, create a **Cloud Firestore** database.
2. Replace the default Firestore rules with the contents of `firestore.rules` and publish them.

The rules intentionally do **not** trust the browser. Only a Firebase user whose UID has a matching document in the `admins` collection can create, edit or delete products/settings.

## 4. Approve your Google account

1. Visit `https://septembermoon.uk/admin.html` and sign in with the Google account you want to use.
2. The first time, the page will say **Account not authorised** and show your Firebase user ID (UID).
3. Copy that UID.
4. In Firestore Console, create a collection named `admins`.
5. Create a document whose **document ID is exactly that UID**. It can be an empty document; if the console requires a field, add something harmless such as `name: Owner`.
6. Refresh `/admin.html`.

That account is now the administrator. Other Google accounts can authenticate with Google, but Firebase will deny them access to admin data and writes unless you deliberately create an `admins/<their UID>` document.

## 5. Enable image uploads

The product editor can still use ordinary image URLs/local paths without Firebase Storage. For the built-in upload and image-library features:

1. Open **Storage** in Firebase Console and create the default bucket.
2. Publish the contents of `storage.rules` as the Storage rules. Because these rules check the Firestore `admins` collection, Firebase may prompt you once to grant Storage permission to read Firestore for rule evaluation; accept that connection.
3. Ensure the `storageBucket` value in `js/firebase-config.js` exactly matches the bucket shown by Firebase.

**Current Firebase requirement:** Cloud Storage for Firebase requires the project to be on the Blaze pay-as-you-go plan. Set a Google Cloud budget alert before using it. The supplied rules only allow approved admins to list/upload/delete images, limit uploads to image files under 10 MB, and allow public read access to individual product images.

## 6. Import the existing catalogue

Once you are authorised in `/admin.html`:

1. Open **Overview**.
2. Click **Import existing catalogue**.

This imports all **197 products** extracted from the original `collections.html` and `Coming-Soon.html` into Firestore. Four products are marked as featured for the homepage.

The original ZIP did not contain most of the product image files referenced by the HTML (for example `images/forsale/...`). Those paths have been preserved in the imported product data. Broken/missing images show the site's existing `comingsoon.png` fallback until you upload replacements in Admin.

## 7. Maintenance mode

In Admin > **Site settings** you can:

- switch Maintenance mode on/off;
- edit the maintenance-page heading;
- edit its message;
- optionally set an image URL.

When enabled, normal public pages redirect to `maintenance.html`. `/admin.html` remains available so you can switch the site back on.

Because the current site is static hosting, this is a client-side maintenance gate rather than a web-server shutdown. It is appropriate for a friendly maintenance page, but it is not intended as a security barrier for sensitive content.

## Optional: deploy the rules with Firebase CLI

If you use Firebase CLI instead of pasting rules in the Console, this build includes `firebase.json`:

```bash
firebase login
firebase use YOUR_FIREBASE_PROJECT_ID
firebase deploy --only firestore:rules,storage
```

Your normal static site can continue to be deployed where it is now; Firebase is only providing Authentication, Firestore and (optionally) Storage.
