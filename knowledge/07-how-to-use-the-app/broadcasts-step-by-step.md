# Broadcasts: adding a supplier message

**Status:** DRAFT
**Purpose:** How to bring a supplier's WhatsApp (or email) price and stock message into the app: choosing the supplier and contact, pasting the message, and what happens next.
**Sources:** the application's documentation and the New broadcast form (docs/modules/BROADCASTS.md, docs/design/SCREENS.md). Written from the documentation; check the labels against the live screen.

## What a broadcast is

A broadcast is one message from a supplier that lists products, prices or stock. The app saves the message exactly as pasted (the evidence), then proposes the items in it. A person reviews them before anything becomes a price or stock record.

## Before you start

1. The supplier must exist under **Suppliers**. If there are none, the New broadcast page says "Add a supplier first" and offers **Go to Suppliers**. A new supplier is added from Suppliers with **Add supplier**.
2. If you want the message tied to a person, the contact must exist on the supplier's **Contacts** tab. The contact is optional.
3. Have the message ready to copy from WhatsApp (or the email).

## Step by step

1. Open **Broadcasts** in the left sidebar, then choose **New broadcast**.
2. **Supplier** (required): choose the supplier who sent the message. Pick the exact supplier; do not use a similar name.
3. **Contact (optional):** choose the person at that supplier who sent it. The list shows only that supplier's contacts. Choose a supplier first.
4. **Received via:** how it arrived. The default is manual paste; the choices are WhatsApp, Email or Other.
5. **Received at (Dubai time):** when the supplier actually sent it. It defaults to now. Change it if you are pasting an older message, because how fresh a price is counted from this time.
6. **Category (optional):** a hint for items the parser cannot classify from the text itself. Leave it empty if the message mixes categories.
7. **Supplier message:** paste the whole message here (see below).
8. **Notes (optional):** anything the team should know about this message.
9. Choose **Save and extract items**. The app saves the original text, proposes the items, and opens the review screen.

## Pasting from WhatsApp

- Copy the whole message from WhatsApp and paste it as it is. Do not retype, tidy or shorten it. Emoji, bullets, capital letters and odd spacing are fine; the app ignores that when it reads the items, and the original is kept untouched as evidence.
- Keep the footer lines at the end such as `SUPPLIER : NAME` and `CONTACT : NAME`. They are used to fill the supplier and contact for you (see next section).
- One message from one supplier per broadcast. If you have messages from two suppliers, add two broadcasts.
- Only text can be pasted. Screenshots, PDFs and Excel files are not supported yet. If a supplier sends one, type or paste the lines that matter, or add items by hand on the review screen.

## Shortcuts for picking the supplier and contact

- **Read from the message:** many supplier lists end with `SUPPLIER : NAME` and `CONTACT : NAME` (also `COMPANY`, `VENDOR`, `ATTN`). When you paste, the form picks the supplier if exactly one supplier has that name, then the contact the same way. A small note says "Read from the message: supplier X, contact Y." A partial name never matches, and nothing is created for you.
- **When nothing matches** you get a warning instead: no supplier has exactly that name (choose one, or add it under Suppliers), more than one has it, the supplier has no contact with that name, or the message names a different supplier or contact than the one you chose.
- **Your own choice wins:** a supplier or contact you pick by hand is never replaced by the message.
- **@ mentions:** in the message box, type `@` after `SUPPLIER :` to get a list of suppliers that narrows as you type, or after `CONTACT :` for that supplier's contacts. Use the arrow keys and Enter (or Tab) to pick, Escape to close. An `@` in a price such as `Dell 5440 @ 2450` does not open the list.

## If the message was already saved

If the same supplier already has exactly this text, the form warns you. You may still save it by ticking **Save anyway**. Usually you should not: check the existing broadcast first.

## When the message answers a sourcing request

If you asked a supplier for a price on an enquiry, open the enquiry's **Sourcing** tab and use **Record reply**. The form opens as **Record reply** with the supplier already chosen, and saving marks the request as replied and links the message to the enquiry. From there it is reviewed like any other broadcast.

## What happens next

You land on the review screen for this broadcast. Continue with review-and-confirm.

## Things to confirm

- TO BE FILLED: Who on the team adds broadcasts, and how soon after a message arrives.
- TO BE FILLED: How the team copies WhatsApp messages (from the phone, WhatsApp Web, or an export).
- TO BE FILLED: What to do with supplier price lists sent as PDF, Excel or images.

## Unknowns

- The items under "Things to confirm" are unknown. Do not assume them; ask.
