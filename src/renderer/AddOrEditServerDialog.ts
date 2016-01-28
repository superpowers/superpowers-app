import { BaseDialog } from "simple-dialogs";

type AddOrEditOptions = {
  validationLabel: string;
  initialAddressValue: string;
  initialPortValue: string;
  initialLabelValue: string;
}
export interface AddOrEditServerResult { address: string; port: string; label: string; };

export default class AddOrEditServerDialog extends BaseDialog<AddOrEditServerResult> {
  private addressInputElt: HTMLInputElement;
  private portInputElt: HTMLInputElement;
  private labelInputElt: HTMLInputElement;

  constructor(promptLabel: string, options: AddOrEditOptions, callback: (result: AddOrEditServerResult) => void) {
    super(callback);
    
    // Prompt name
    const labelElt = document.createElement("label");
    labelElt.textContent = promptLabel;
    this.formElt.appendChild(labelElt);

    const addressRootElt = document.createElement("div");
    addressRootElt.style.display = "flex";
    this.formElt.appendChild(addressRootElt);

    // Address
    this.addressInputElt = document.createElement("input");
    this.addressInputElt.style.flex = "1";
    this.addressInputElt.required = true;
    this.addressInputElt.value = options.initialAddressValue;
    this.addressInputElt.title = "Address";
    this.addressInputElt.placeholder = "Address";
    addressRootElt.appendChild(this.addressInputElt);

    const separatorElt = document.createElement("label");
    separatorElt.style.margin = "0 0.5em";
    separatorElt.textContent = ":";
    addressRootElt.appendChild(separatorElt);

    // Port
    this.portInputElt = document.createElement("input");
    this.portInputElt.value = options.initialPortValue;
    this.portInputElt.title = "Port";
    this.portInputElt.placeholder = "Port";
    addressRootElt.appendChild(this.portInputElt);

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
    
    this.addressInputElt.focus();
  }
  
  submit() {
    const result = {
      address: this.addressInputElt.value,
      port: this.portInputElt.value !== "" ? this.portInputElt.value : null,
      label: this.labelInputElt.value
    };
    super.submit(result);
  }
}
