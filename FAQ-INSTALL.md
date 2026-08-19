# September Moon – Long-term FAQ setup

This patch adds a public `faq.html` page whose content is managed from your existing Firebase-backed admin panel.

## Files in this patch

Copy these into the matching locations in your website project:

- `faq.html`
- `faq.css`
- `js/faq.js`
- `js/admin-faq.js`
- `firestore.rules` (replace your existing local copy)

## 1. Load the FAQ admin extension

Open `admin.html`.

At the bottom you currently have a line similar to:

```html
<script type="module" src="js/admin.js?v=8"></script>
```

Immediately AFTER it, add:

```html
<script type="module" src="js/admin-faq.js?v=1"></script>
```

So the end becomes:

```html
<script type="module" src="js/admin.js?v=8"></script>
<script type="module" src="js/admin-faq.js?v=1"></script>
</body>
</html>
```

You do not need to edit your large `js/admin.js` file.

## 2. Add FAQ to the public navigation

On each public page where you want FAQ in the top menu (`index.html`, `collections.html`, `Coming-Soon.html`, `story.html`), find:

```html
<a href="story.html">Our story</a>
```

Immediately after it add:

```html
<a href="faq.html">FAQ</a>
```

`faq.html` already contains this link in its own navigation.

## 3. Publish the Firestore rules

The replacement `firestore.rules` adds the `faqs` collection.

In Firebase Console:

1. Firestore Database
2. Rules
3. Replace the current rules with the contents of this `firestore.rules`
4. Click Publish

The rules allow:
- anyone to read FAQ items where `visible == true`
- only your approved admin account to create, edit, reorder or delete FAQs

## 4. Commit and push

Commit/push the new files and your small `admin.html`/navigation edits to `main`.

## 5. Add FAQs

Open:

`https://septembermoon.uk/admin.html`

A new **FAQ** item appears in the left-hand admin navigation.

From there you can:
- add questions and answers
- edit them
- show/hide them
- move them up/down
- delete them
- preview the public FAQ page

The public page is:

`https://septembermoon.uk/faq.html`

No FAQ content is hard-coded into the page. Firestore is the source of truth, so future FAQ changes do not require editing HTML.
