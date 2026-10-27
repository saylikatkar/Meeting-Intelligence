import { useState } from "react";
import Panel from "./Panel";
import { useAuth } from "../context/AuthContext";
import { inputClass, primaryButton, secondaryButton } from "./ui";

const PHOTO_SIZE = 256;
const MAX_PHOTO_MB = 5;

// shrink the picked image to a small square JPEG so it fits in localStorage
function resizePhoto(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const side = Math.min(img.width, img.height);
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = PHOTO_SIZE;
      canvas
        .getContext("2d")
        .drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, PHOTO_SIZE, PHOTO_SIZE);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("That file couldn't be read as an image."));
    };
    img.src = url;
  });
}

// Name / email / role card. `onSave(name)` stores the new name.
// Pass `onPhotoChange(dataUrl | null)` to let the user upload a profile photo.
function ProfilePanel({ roleLabel, note, onSave, onPhotoChange }) {
  const { user, updateProfile } = useAuth();
  const [name, setName] = useState(user.name);
  const [message, setMessage] = useState(null);
  const [photoMessage, setPhotoMessage] = useState(null);

  async function handlePhoto(e) {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setPhotoMessage({ ok: false, text: "Please choose an image file." });
      return;
    }
    if (file.size > MAX_PHOTO_MB * 1024 * 1024) {
      setPhotoMessage({ ok: false, text: `Please choose an image under ${MAX_PHOTO_MB} MB.` });
      return;
    }
    try {
      const avatar = await resizePhoto(file);
      updateProfile({ avatar });
      onPhotoChange(avatar);
      setPhotoMessage({ ok: true, text: "Photo updated." });
    } catch (err) {
      setPhotoMessage({ ok: false, text: err.message });
    }
  }

  function removePhoto() {
    updateProfile({ avatar: null });
    onPhotoChange(null);
    setPhotoMessage({ ok: true, text: "Photo removed." });
  }

  const initials = user.name
    .split(/[\s.]+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  function handleSubmit(e) {
    e.preventDefault();
    if (name.trim().length < 2) {
      setMessage({ ok: false, text: "Please enter your full name." });
      return;
    }
    updateProfile({ name: name.trim() });
    onSave(name.trim());
    setMessage({ ok: true, text: "Profile saved." });
  }

  return (
    <Panel title="Profile details" className="h-fit">
      <form onSubmit={handleSubmit} className="p-4 space-y-4">
        {onPhotoChange && (
          <div className="flex items-center gap-4">
            <span className="w-16 h-16 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center text-lg font-bold overflow-hidden shrink-0">
              {user.avatar ? <img src={user.avatar} alt="" className="w-full h-full object-cover" /> : initials}
            </span>
            <div>
              <div className="flex flex-wrap gap-2">
                <label className={`${secondaryButton} cursor-pointer`}>
                  {user.avatar ? "Change photo" : "Upload photo"}
                  <input type="file" accept="image/*" onChange={handlePhoto} className="sr-only" />
                </label>
                {user.avatar && (
                  <button type="button" onClick={removePhoto} className={secondaryButton}>
                    Remove
                  </button>
                )}
              </div>
              {photoMessage ? (
                <p className={`text-xs mt-1.5 ${photoMessage.ok ? "text-green-700" : "text-red-600"}`}>{photoMessage.text}</p>
              ) : (
                <p className="text-xs text-gray-500 mt-1.5">JPG, PNG or GIF, up to {MAX_PHOTO_MB} MB.</p>
              )}
            </div>
          </div>
        )}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
            Full name
          </label>
          <input id="name" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            Email address
          </label>
          <input id="email" value={user.email} disabled className={`${inputClass} bg-gray-50 text-gray-500`} />
        </div>
        <div>
          <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">
            Workspace role
          </label>
          <input id="role" value={roleLabel} disabled className={`${inputClass} bg-gray-50 text-gray-500`} />
        </div>
        {note && <p className="text-xs text-gray-500">{note}</p>}
        <div className="flex items-center gap-3">
          <button type="submit" className={primaryButton}>
            Save changes
          </button>
          {message && <span className={`text-sm ${message.ok ? "text-green-700" : "text-red-600"}`}>{message.text}</span>}
        </div>
      </form>
    </Panel>
  );
}

export default ProfilePanel;
