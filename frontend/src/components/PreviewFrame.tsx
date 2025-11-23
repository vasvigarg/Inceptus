import { WebContainer } from "@webcontainer/api";
import React, { useEffect, useState } from "react";

interface PreviewFrameProps {
  files: any[];
  webContainer?: WebContainer;
}

export function PreviewFrame({ files, webContainer }: PreviewFrameProps) {
  const [url, setUrl] = useState("");

  async function main() {
    if (!webContainer) return;

    const installProcess = await webContainer.spawn("npm", ["install"]);

    installProcess.output.pipeTo(
      new WritableStream({
        write(data) {
          console.log(data);
        },
      })
    );

    await webContainer.spawn("npm", ["run", "dev"]);

    webContainer.on("server-ready", (port, url) => {
      console.log(url);
      console.log(port);
      setUrl(url);
    });
  }

  useEffect(() => {
    if (!webContainer) return;
    main();
  }, [webContainer]);

  return (
    <div className="h-full flex items-center justify-center bg-black">
      {!url && (
        <div className="text-center">
          <p className="text-gray-500">Loading preview...</p>
        </div>
      )}
      {url && <iframe width={"100%"} height={"100%"} src={url} />}
    </div>
  );
}
