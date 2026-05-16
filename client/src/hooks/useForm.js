import { useState } from "react";

// Shared form-state helper so each editor form does not re-implement the same
// controlled-input boilerplate.
export function useForm(initialValues) {
  const [values, setValues] = useState(initialValues);

  function setField(name, value) {
    setValues((current) => ({ ...current, [name]: value }));
  }

  function handleChange(event) {
    const { name, value } = event.target;
    setField(name, value);
  }

  function reset() {
    setValues(initialValues);
  }

  return { values, setValues, setField, handleChange, reset };
}
