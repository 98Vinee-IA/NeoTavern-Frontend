import toastr from 'toastr';

export const toastPositionClasses = [
  'toast-top-left',
  'toast-top-center',
  'toast-top-right',
  'toast-bottom-left',
  'toast-bottom-center',
  'toast-bottom-right',
];

/**
 * Fixes the issue with toastr not displaying on top of the dialog by moving the toastr container inside the dialog or back to the main body
 */
export function fixToastrForDialogs() {
  // Hacky way of getting toastr to actually display on top of the popup...
  const dlg = Array.from(document.querySelectorAll('dialog[open]:not([closing])')).pop();

  let toastContainer = document.getElementById('toast-container');
  const isAlreadyPresent = !!toastContainer;
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.setAttribute('id', 'toast-container');
    if (toastr.options.positionClass) toastContainer.classList.add(toastr.options.positionClass);
  }

  // Check if toastr is already a child. If not, we need to move it inside this dialog.
  // This is either the existing toastr container or the newly created one.
  if (dlg && !dlg.contains(toastContainer)) {
    dlg?.appendChild(toastContainer);
    return;
  }

  // Now another case is if we only have one popup and that is currently closing. In that case the toastr container exists,
  // but we don't have an open dialog to move it into. It's just inside the existing one that will be gone in milliseconds.
  // To prevent new toasts from being showing up in there and then vanish in an instant,
  // we move the toastr back to the main body, or delete if its empty
  if (!dlg && isAlreadyPresent) {
    if (!toastContainer.childNodes.length) {
      toastContainer.remove();
    } else {
      document.body.appendChild(toastContainer);
      toastContainer.classList.remove(...toastPositionClasses);
      if (toastr.options.positionClass) toastContainer.classList.add(toastr.options.positionClass);
    }
  }
}
