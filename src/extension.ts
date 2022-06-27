import * as vscode from "vscode";

import html from "@hyrious/marked-cli/index.vscode.html";

interface Item {
  panel: vscode.WebviewPanel;
  doc: vscode.TextDocument;
  update: () => void;
  close: () => void;
}

let panels = new Set<Item>();

function findPanelByDoc(doc: vscode.TextDocument): Item | undefined {
  for (const panel of panels) {
    if (panel.doc === doc) {
      return panel;
    }
  }
}

function createPanel(doc: vscode.TextDocument): Item {
  const panel = vscode.window.createWebviewPanel(
    "vscode-marked.panel",
    "Preview Markdown",
    vscode.ViewColumn.Beside,
    { enableScripts: true }
  );

  function update() {
    panel.webview.postMessage(JSON.stringify(doc.getText()));
  }

  function close() {
    panel.dispose();
    panels.delete(item);
  }

  const item: Item = { panel, doc, update, close };
  panels.add(item);

  panel.onDidDispose(close);
  panel.webview.html = html;

  update();

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
        createPanel(doc);
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
