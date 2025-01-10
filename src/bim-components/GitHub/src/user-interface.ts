import * as BUI from "@thatopen/ui";
import * as OBC from "@thatopen/components";
import { GitHub, fileData } from "..";

// Interface for the Stateful Component
interface GitUIState {
  components: OBC.Components;
}

export function GitUI(components: OBC.Components) {
  const git = components.get(GitHub);

  // text inputs for the needed fields.
  const ownerInput = document.createElement("bim-text-input");
  const repoInput = document.createElement("bim-text-input");

  ownerInput.placeholder = "Repo Owner";
  repoInput.placeholder = "Repo Name";

  const onConnectClick = () => {
    const owner = ownerInput.value.trim();
    const repo = repoInput.value.trim();

    git.connect(owner, repo);
  };

  // Stateful component
  // filesList contains the final HTML structure, update contains a function to update
  // filesList
  const [filesList, updateFilesList] = BUI.Component.create<
    HTMLDivElement,
    GitUIState
  >(
    (state: GitUIState) => {
      const { components } = state;
      const git = components.get(GitHub);

      // For each matching commit, create a label with the message of
      // the commit and a button to retrieve that file.
      return BUI.html`
        <div style="display: flex; flex-direction: column; gap: 0.5rem;">
          ${git.filesList.map((file) => {
            return BUI.html`
            <div style="display: flex; justify-content: space-between;">
              <bim-label style="flex-grow: 2;">${file.name}</bim-label>
              <div style="max-width: 200px;">${file.commits}</div>
            </div>
              `;
          })}
        </div>
        `;
    },
    { components },
  );

  // This adds the function to the trigger
  git.onConnect.add(() => updateFilesList());

  // A panel section with the rest of the UI.
  return BUI.Component.create<BUI.PanelSection>(() => {
    return BUI.html`
      <bim-panel-section label="GitHub" icon="fa:github" style="flex-grow:1">
        <div style="display: flex; flex-direction: row; align-items: flex-start; gap: 0.375rem"> 
            ${ownerInput}
            ${repoInput}
        </div>
        <bim-button label="Connect" @click=${onConnectClick}></bim-button>
        <bim-label style="align-items: center;">Files</bim-label>
        ${filesList}
      </bim-panel-section>
    `;
  });
}
