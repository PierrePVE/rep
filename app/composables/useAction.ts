/**
 * Shared wrapper for mutating API calls whose outcome is reported in a toast:
 * tracks the pending state, shows the success or error message.
 *
 * One instance tracks one action: call it once per button that needs its own
 * spinner. Forms that show their error inline (next to the field to fix) do
 * not use it.
 *
 * @returns `pending` for the template, and `run` to execute a mutation.
 */
export function useAction() {
  const toast = useToast()
  const pending = ref(false)

  /**
   * Runs a mutation and toasts its result.
   * The callback must await its $fetch call rather than return it
   * (`async () => { await $fetch(...) }`): returning it makes TypeScript
   * compare Nitro's typed-route result with `Promise<unknown>`, which fails
   * with the "excessive stack depth" error described in useAuthSubmit.
   *
   * @param action - The API call to perform; its result is ignored.
   * @param successTitle - Toast shown on success, if any.
   * @returns Whether the call succeeded, so the caller can chain a refresh or
   *   a navigation only on success.
   */
  async function run(action: () => Promise<unknown>, successTitle?: string) {
    pending.value = true
    try {
      await action()
      if (successTitle) toast.add({ title: successTitle, color: 'success' })
      return true
    }
    catch (e) {
      toast.add({ title: apiErrorMessage(e), color: 'error' })
      return false
    }
    finally {
      pending.value = false
    }
  }

  return { pending, run }
}
