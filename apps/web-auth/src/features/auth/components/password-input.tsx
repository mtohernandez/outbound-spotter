import { Button } from "@outbound/ui/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@outbound/ui/components/ui/input-group";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { useState, type ComponentProps, type Ref } from "react";

type InputProps = Omit<ComponentProps<"input">, "type">;

interface PasswordInputProps extends InputProps {
  /**
   * `current-password` for sign-in, `new-password` for sign-up + reset.
   */
  readonly autoComplete?: "current-password" | "new-password" | "one-time-code";
  readonly ref?: Ref<HTMLInputElement>;
}

export function PasswordInput({
  autoComplete = "current-password",
  ref,
  ...inputProps
}: PasswordInputProps): React.ReactElement {
  const [visible, setVisible] = useState(false);

  return (
    <InputGroup>
      <InputGroupInput
        ref={ref}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        spellCheck={false}
        autoCorrect="off"
        {...inputProps}
      />
      <InputGroupAddon align="inline-end">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          // APG button-toggle pattern: the accessible name must stay constant across states;
          // aria-pressed conveys the on/off state, the icon swap is purely visual.
          // https://www.w3.org/WAI/ARIA/apg/patterns/button/
          aria-pressed={visible}
          aria-label="Password visibility"
          onClick={() => {
            setVisible((current) => !current);
          }}
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </Button>
      </InputGroupAddon>
    </InputGroup>
  );
}
