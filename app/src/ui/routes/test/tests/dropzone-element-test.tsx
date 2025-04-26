import { Media } from "ui/elements";
import { Scrollable } from "ui/layouts/AppShell/AppShell";

export default function DropzoneElementTest() {
   return (
      <Scrollable>
         <div className="flex flex-col w-full h-full p-4 gap-4">
            {/*<div>
               <b>Dropzone no auto avif only</b>
               <Media.Dropzone autoUpload={false} allowedMimeTypes={["image/avif"]} />

               <b>Dropzone User Avatar 1 (fully customized)</b>
               <Media.Dropzone
                  entity={{ name: "users", id: 1, field: "avatar" }}
                  maxItems={1}
                  overwrite
               >
                  <CustomUserAvatarDropzone />
               </Media.Dropzone>
            </div>*/}

            <div>
               <b>Dropzone User Avatar 1 (overwrite)</b>
               <Media.Dropzone
                  entity={{ name: "models", id: 38, field: "inputs" }}
                  maxItems={6}
                  autoUpload={false}
               />
            </div>
            <div>
               <b>Dropzone User Avatar 1 (overwrite)</b>
               <Media.Dropzone
                  entity={{ name: "models", id: 38, field: "outputs" }}
                  maxItems={6}
                  autoUpload={false}
               >
                  <Custom />
               </Media.Dropzone>
            </div>

            {/*<div>
               <b>Dropzone User Avatar 1</b>
               <Media.Dropzone entity={{ name: "users", id: 1, field: "avatar" }} maxItems={1} />
            </div>

            <div>
               <b>Dropzone Container blank w/ query</b>
               <Media.Dropzone query={{ limit: 2 }} />
            </div>*/}

            {/*<div>
               <b>Dropzone Container blank</b>
               <Media.Dropzone />
            </div>

            <div>
               <b>Dropzone Post 12</b>
               <Media.Dropzone entity={{ name: "posts", id: 12, field: "images" }} />
            </div>*/}
         </div>
      </Scrollable>
   );
}

function CustomUserAvatarDropzone() {
   const {
      wrapperRef,
      inputProps,
      showPlaceholder,
      actions: { openFileInput },
   } = Media.useDropzone();
   const {
      isOver,
      isOverAccepted,
      files: [file] = [],
   } = Media.useDropzoneState();

   return (
      <div
         ref={wrapperRef}
         className="size-32 rounded-full border border-gray-200 flex justify-center items-center leading-none overflow-hidden"
      >
         <div className="hidden">
            <input {...inputProps} />
         </div>
         {showPlaceholder && <>{isOver && isOverAccepted ? "let it drop" : "drop here"}</>}
         {file && (
            <Media.Preview
               file={file}
               className="object-cover w-full h-full"
               onClick={openFileInput}
            />
         )}
      </div>
   );
}

function Custom() {
   const {
      wrapperRef,
      inputProps,
      showPlaceholder,
      actions: { openFileInput },
   } = Media.useDropzone();
   const { isOver, isOverAccepted, files } = Media.useDropzoneState();

   return (
      <div
         ref={wrapperRef}
         className="size-32 rounded-full border border-gray-200 flex justify-center items-center leading-none overflow-hidden"
      >
         <div className="hidden">
            <input {...inputProps} />
         </div>
         <span>asdf</span>
         {showPlaceholder && <>{isOver && isOverAccepted ? "let it drop" : "drop here"}</>}
         {files.map((file) => (
            <Media.Preview
               key={file.path}
               file={file}
               className="object-cover w-full h-full"
               onClick={openFileInput}
            />
         ))}
      </div>
   );
}
