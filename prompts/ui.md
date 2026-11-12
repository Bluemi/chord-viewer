# UI

The UI has the following pages:

# Login Page

This should ask for a password.
The main page should only open, once you entered the correct password. Make sure to never send the password plaintext.

## Authentication

The authenication works only via a password, as I only intend to use this myself with a single user.
The password should be configurable in the backend via a file or configuration file.

# Project Overview

Once logged in, you see the project overview page. This shows all available songs in a list prioritised by last edit date.
Clicking on a song opens this song in the Song View.
There is also a button, that creates a new song.

# Song View

The title of the song is shown.
Under that it shows the text of the song and the chords above it.
There are two rows, one for chords and under that a row for text.
If the text reaches the right side of the page or when I press Enter, wrap around and start the next two rows.
Each row of chords starts with a line number.

There is an edit button, that lets me edit the chords and text.
There is a play button, that plays the underlaying music track and scrolls the text / chords for play along.
There is a upload button, that lets me upload and update a music track.
There is a progress bar at the bottom that shows the progress of the underlaying music track. Clicking on it moves to this playback position.

## When playing

The progress bar can be synced with the scroll position of the chords.
The chord and text at the current play-position is highlighted.
The audio track is played, if any audio was supplied.

## When editing

Clicking in a text or chord-row let's me edit the chords / text.
When I'm done editing, auto save (persist to database).
Allow undo and redo.

### Syncing audio and text

In edit-mode, there is another button, that let's me sync chords to the audio track (or timeline, if no audio is available).
It only works, if chords a already written.
When I press the sync-button, it plays the song. Whenever I press Space, it creates a timestamp for the next chord.
Use these timestamps for playback.
