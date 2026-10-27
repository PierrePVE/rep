<!--
  Layout of the logged-out pages (login, sign-up): a centred column, without
  the bottom tab bar, whose tabs would all redirect to /login anyway.
-->
<template>
  <div class="flex min-h-dvh items-center justify-center bg-default px-4 py-8 pt-[max(2rem,env(safe-area-inset-top))]">
    <main class="w-full max-w-sm">
      <slot />
    </main>
  </div>
</template>
