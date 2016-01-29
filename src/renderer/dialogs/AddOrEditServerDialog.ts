import { BaseDialog } from "simple-dialogs";

type AddOrEditOptions = {
  validationLabel: string;
  initialHostnameValue: string;
  initialPortValue: string;
  initialLabelValue: string;
}

interface AddOrEditServerResult {
  hostname: string;
  port: string;
  label: string;
};

export default class AddOrEditServerDialog extends BaseDialog<AddOrEditServerResult> {
  private hostnameInputElt: HTMLInputElement;
  private portInputElt: HTMLInputElement;
  private labelInputElt: HTMLInputElement;

  constructor(promptLabel: string, options: AddOrEditOptions, callback: (result: AddOrEditServerResult) => void) {
    super(callback);

    // Prompt name
    const labelElt = document.createElement("label");
    labelElt.textContent = promptLabel;
    this.formElt.appendChild(labelElt);

    const hostRootElt = document.createElement("div");
    hostRootElt.style.display = "flex";
    this.formElt.appendChild(hostRootElt);

    // Hostname
    this.hostnameInputElt = document.createElement("input");
    this.hostnameInputElt.style.flex = "1";
    this.hostnameInputElt.required = true;
    this.hostnameInputElt.value = options.initialHostnameValue;
    this.hostnameInputElt.title = "Hostname";
    this.hostnameInputElt.placeholder = "Hostname";
    hostRootElt.appendChild(this.hostnameInputElt);

    const separatorElt = document.createElement("label");
    separatorElt.style.margin = "0 0.5em";
    separatorElt.textContent = ":";
    hostRootElt.appendChild(separatorElt);

    // Port
    this.portInputElt = document.createElement("input");
    this.portInputElt.value = options.initialPortValue;
    this.portInputElt.title = "Port";
    this.portInputElt.placeholder = "Port";
    hostRootElt.appendChild(this.portInputElt);

    // Label
    this.labelInputElt = document.createElement("input");
    this.labelInputElt.value = options.initialLabelValue;
    this.labelInputElt.title = "Label";
    this.labelInputElt.placeholder = "Label";
    this.formElt.appendChild(this.labelInputElt);

    // Buttons
    const buttonsElt = document.createElement("div");
    buttonsElt.className = "buttons";
    this.formElt.appendChild(buttonsElt);

    const cancelButtonElt = document.createElement("button");
    cancelButtonElt.type = "button";
    cancelButtonElt.textContent = BaseDialog.defaultLabels["cancel"];
    cancelButtonElt.className = "cancel-button";
    cancelButtonElt.addEventListener("click", (event) => { event.preventDefault(); this.cancel(); });

    this.validateButtonElt = document.createElement("button");
    this.validateButtonElt.textContent = options.validationLabel;
    this.validateButtonElt.className = "validate-button";

    if (navigator.platform === "Win32") {
      buttonsElt.appendChild(this.validateButtonElt);
      buttonsElt.appendChild(cancelButtonElt);
    } else {
      buttonsElt.appendChild(cancelButtonElt);
      buttonsElt.appendChild(this.validateButtonElt);
    }

    this.hostnameInputElt.focus();
  }

  submit() {
    const result = {
      hostname: this.hostnameInputElt.value,
      port: this.portInputElt.value !== "" ? this.portInputElt.value : null,
      label: this.labelInputElt.value
    };
    super.submit(result);
  }
}
