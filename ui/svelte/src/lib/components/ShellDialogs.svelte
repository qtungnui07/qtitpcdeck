<script lang="ts">
  /*
   * The dialogs the shell owns.
   *
   * These are mounted once, at the root, rather than by whichever page happens to open them: a
   * dialog that lives inside a page disappears when the route changes, and an announcement that
   * arrives while the user is navigating would be lost mid-read.
   */
  import AnnouncementDialog from './AnnouncementDialog.svelte';
  import SettingsModal from './SettingsModal.svelte';
  import { announcements, dismissAnnouncement } from '$lib/announcements.svelte';
</script>

{#if announcements.pending}
  <AnnouncementDialog
    title={announcements.pending.title}
    content={announcements.pending.content}
    publishedAt={announcements.pending.publishedAt}
    ondismiss={dismissAnnouncement}
  />
{/if}

<SettingsModal />
