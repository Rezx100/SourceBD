# Gap 9 — Messages: unread, read ticks, the last line, files (data and access)

Paper gap list row 9. Boards: `10-App-Desktop-Messages-saved-compliance/Messages-Thermax-…[3U7-0]`, `…thread-with-
record-beside…[4CC-0]` and the phone twins. Status: **migration written and dry-run, not applied**
(`0112_messages_unread_files.sql`, `ops/plans/0112-dry-run.md`). Screens are Sonnet's, below.

## What is stored

- `thread_participants.last_read_at`: how far each person has read. Existing rows are stamped at apply time.
- `message_attachments(message_id, thread_id, object_path, file_name, mime_type, size_bytes)`, read only through
  `thread_messages`.
- Private bucket `message-files` (25 MB a file; PDF, JPEG, PNG, WebP, Excel, Word, CSV). Path
  `<thread_id>/<your user id>/<random>/<file name>`. A participant uploads only into their own folder of a
  conversation they are in, and reads every file of it (signed URLs under their own session).

## The calls

| Call | Returns |
| --- | --- |
| `thread_list()` | 0035's keys plus `unread_count`, `has_reply` (the other side has written), `last_body` (140 characters, `""` for a file-only message), `last_is_self` |
| `thread_messages(thread, limit, before)` | 0027's keys plus `read` (your message, and the other side has read up to it) and `attachments[{id,path,file_name,mime_type,size_bytes}]` |
| `thread_mark_read(thread)` | marks it read for you; call when a conversation opens and when a new message arrives while it is open |
| `thread_unread_total()` | conversations with something unread: the sidebar's "N new" and the "Unread · N" tab |
| `thread_send_message_files(thread, body, paths[])` | sends text, up to 10 uploaded files, or both; marks it read for you |

Errors: `28000` signed out, `42501` not in the conversation or not your file, `22023` empty or too long, `P0002`
a file that was never uploaded.

## For Sonnet (the screens)

1. Inbox: the unread dot and bold name from `unread_count`; tabs All · N, Unread · N (`unread_count > 0`),
   No reply yet · N (`!has_reply`); the last line from `last_body`, "You: " when `last_is_self`, "Sent a file" when
   empty. Drop the per-conversation reads for the last line (the 30-call finding).
2. Conversation: `thread_mark_read` on open; "Read" after the time on your last message when `read`; files as
   Paper's card (name, "PDF · 2.1 MB"), opened with a signed URL; an attach button that uploads to the path
   above with the browser session, then `thread_send_message_files`.
3. Sidebar badge from `thread_unread_total()` (it waits on the async slot, row 24, Opus).

Not built, on purpose: deleting a file that was uploaded but never sent (it stays in the bucket, readable only by
the conversation); unread email notices (row 10's sending work).
