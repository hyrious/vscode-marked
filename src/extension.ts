import * as vscode from "vscode";
import * as uri from "vscode-uri";

import html from "@hyrious/marked-cli/index.vscode.html";

declare function setTimeout(fn: () => void, ms: number): any;

interface Item {
  panel: vscode.WebviewPanel;
  doc: vscode.TextDocument;
  update: () => void;
  close: () => void;
  asWebviewUri: (uri: vscode.Uri) => vscode.Uri;
}

let panels = new Set<Item>();

function findPanelByDoc(doc: vscode.TextDocument): Item | undefined {
  for (const panel of panels) {
    if (panel.doc === doc) {
      return panel;
    }
  }
}

function createPanel(doc: vscode.TextDocument, subscriptions: { dispose(): any }[]): Item {
  const baseRoots: vscode.Uri[] = [];
  const folder = vscode.workspace.getWorkspaceFolder(doc.uri);
  if (folder) {
    const workspaceRoots = vscode.workspace.workspaceFolders?.map(folder => folder.uri);
    if (workspaceRoots) {
      baseRoots.push(...workspaceRoots);
    }
  } else {
    baseRoots.push(uri.Utils.dirname(doc.uri));
  }

  const panel = vscode.window.createWebviewPanel(
    "vscode-marked.panel",
    "Preview Markdown",
    vscode.ViewColumn.Beside,
    { enableScripts: true, enableForms: false, localResourceRoots: baseRoots }
  );

  function update() {
    panel.webview.postMessage(JSON.stringify({ notifyTransformSrc: true }));
    panel.webview.postMessage(JSON.stringify(doc.getText()));
  }

  function close() {
    panel.dispose();
    panels.delete(item);
  }

  function asWebviewUri(resource: vscode.Uri) {
    return panel.webview.asWebviewUri(resource);
  }

  const item: Item = { panel, doc, update, close, asWebviewUri };
  panels.add(item);

  panel.webview.html = html;

  type MarkedMessage = { transformSrc: string[] };
  function transformSrc(src: string) {
    let ret = "";
    let uri = vscode.Uri.parse("markdown-link:" + src);
    if (folder) {
      uri = vscode.Uri.joinPath(folder.uri, uri.fsPath);
      ret = asWebviewUri(uri).toString(true);
    } else {
      ret = uri.toString(true).replace(/^markdown-link:/, "");
    }
    return ret;
  }

  panel.webview.onDidReceiveMessage(
    (ev: MarkedMessage) => {
      if (ev.transformSrc) {
        panel.webview.postMessage(
          JSON.stringify({
            transformSrc: ev.transformSrc.map(src => [src, transformSrc(src)]),
          })
        );
      }
    },
    undefined,
    subscriptions
  );

  panel.onDidDispose(close, undefined, subscriptions);

  update();
  setTimeout(update, 1000);

  return item;
}

export function activate(context: vscode.ExtensionContext) {
  let doc: vscode.TextDocument | undefined;
  let item: Item | undefined;

  context.subscriptions.push(
    vscode.commands.registerCommand("vscode-marked.render", () => {
      if (!(doc = vscode.window.activeTextEditor?.document)) {
        return;
      }
      if ((item = findPanelByDoc(doc))) {
        item.panel.reveal();
      } else {
        createPanel(doc, context.subscriptions);
      }
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(doc => {
      panels.forEach(p => p.doc === doc && p.update());
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidCloseTextDocument(doc => {
      panels.forEach(p => p.doc === doc && p.close());
    })
  );
}

export function deactivate() {
  panels.forEach(p => p.close());
}
