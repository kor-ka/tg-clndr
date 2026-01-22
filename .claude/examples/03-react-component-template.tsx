/**
 * Example: React Component Template
 *
 * This template shows the standard patterns for creating React components
 * in this project, including state management, event handling, and Telegram
 * integration.
 *
 * Key Patterns:
 * - Functional components with hooks
 * - WithModel HOC for SessionModel access
 * - useVMvalue for reactive state
 * - React.useCallback for event handlers
 * - React.useMemo for computed values
 * - React.memo for performance
 * - Inline styles with Telegram CSS variables
 * - Telegram WebApp controllers
 */

import React from "react";
import { useSearchParams } from "react-router-dom";
import { SessionModel } from "../model/SessionModel";
import { ExampleData } from "../shared/entity";
import { useVMvalue } from "../utils/vm/useVM";
import { WithModel } from "./utils/withModelHOC";
import { useHandleOperation } from "./useHandleOperation";
import { useGoBack, useGoHome } from "./utils/navigation/useGoHome";
import { showConfirm } from "./utils/webapp";

// UI Components
import { Card, Button, Page, ListItem, Block } from "./uikit/kit";
import { BackButtonController } from "./uikit/tg/BackButtonController";
import { MainButtonController } from "./uikit/tg/MainButtonController";
import { ClosingConfirmationController } from "./uikit/tg/ClosingConfirmationController";

/**
 * Sub-component: Memoized for performance
 * Pattern: Extract list items to separate memoized components
 */
const ExampleListItem = React.memo(({
  example,
  onEdit
}: {
  example: ExampleData;
  onEdit: (id: string) => void;
}) => {
  const onClick = React.useCallback(() => {
    onEdit(example.id);
  }, [example.id, onEdit]);

  return (
    <ListItem
      titile={example.title}
      subtitle={example.description}
      right="›"
      onClick={onClick}
    />
  );
});

/**
 * Main Screen Component
 * Pattern: WithModel HOC injects SessionModel
 */
const ExampleScreen = WithModel(({ model }: { model: SessionModel }) => {
  /**
   * Reactive state from model
   * Pattern: useVMvalue subscribes to VM and re-renders on changes
   */
  const chatSettings = useVMvalue(model.chatSettings);
  const context = useVMvalue(model.context);
  const userSettings = useVMvalue(model.userSettings);

  /**
   * URL parameters
   * Pattern: Use React Router hooks
   */
  const [searchParams] = useSearchParams();
  const editId = searchParams.get("editId");

  /**
   * Get data from model
   * Pattern: Use module methods to access reactive state
   */
  const editingExample = editId
    ? useVMvalue(model.exampleModule.getExampleVM(editId))
    : undefined;

  /**
   * Local component state
   * Pattern: useState for form inputs
   */
  const [title, setTitle] = React.useState(editingExample?.title ?? '');
  const [description, setDescription] = React.useState(editingExample?.description ?? '');
  const [edited, setEdited] = React.useState(false);

  /**
   * Event handlers
   * Pattern: useCallback to prevent unnecessary re-renders
   */
  const onTitleChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
    setEdited(true);
  }, []);

  const onDescriptionChange = React.useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDescription(e.target.value);
    setEdited(true);
  }, []);

  /**
   * Navigation hooks
   */
  const goBack = useGoBack();
  const goHome = useGoHome();

  /**
   * Operation handler with loading state
   * Pattern: Custom hook for async operations with error handling
   */
  const [handleOperation, loading] = useHandleOperation();

  /**
   * Computed values
   * Pattern: useMemo for expensive computations
   */
  const canEdit = React.useMemo(() => {
    return chatSettings.allowPublicEdit || context.isAdmin;
  }, [chatSettings.allowPublicEdit, context.isAdmin]);

  const isFormValid = React.useMemo(() => {
    return title.trim().length > 0;
  }, [title]);

  const shouldShowSaveButton = React.useMemo(() => {
    return (!editingExample || edited) && canEdit && isFormValid;
  }, [editingExample, edited, canEdit, isFormValid]);

  /**
   * Save handler
   * Pattern: Wrap async operations with handleOperation
   */
  const onSave = React.useCallback(() => {
    if (!model) return;

    handleOperation(
      () => model.exampleModule.saveExample({
        id: editingExample?.id ?? model.nextId() + '',
        title: title.trim(),
        description: description.trim(),
        createdAt: Date.now(),
      }),
      goBack  // Navigate back on success
    );
  }, [model, editingExample, title, description, handleOperation, goBack]);

  /**
   * Delete handler with confirmation
   * Pattern: showConfirm for destructive actions
   */
  const onDelete = React.useCallback(() => {
    if (!editId) return;

    showConfirm("Delete this example? This cannot be undone.", (confirmed) => {
      if (confirmed && model) {
        handleOperation(
          () => model.exampleModule.deleteExample(editId),
          goBack
        );
      }
    });
  }, [editId, model, handleOperation, goBack]);

  /**
   * Render list item
   * Pattern: Callback passed to memoized child components
   */
  const onEditItem = React.useCallback((id: string) => {
    // Navigate to edit screen
    window.location.hash = `/tg/example?editId=${id}`;
  }, []);

  /**
   * Get list data
   * Pattern: Access reactive collections from model
   */
  const examples = Array.from(model.exampleModule.examples.values())
    .map(vm => vm.val)
    .filter(ex => !ex.deleted)
    .sort((a, b) => b.createdAt - a.createdAt);

  /**
   * Render
   * Pattern: Page > Cards > Components structure
   */
  return (
    <Page>
      {/* Telegram back button controller */}
      <BackButtonController />

      {/* Form fields in cards */}
      <Card>
        <input
          value={title}
          onChange={onTitleChange}
          disabled={loading || !canEdit}
          placeholder="Title"
          style={{
            flexGrow: 1,
            padding: '8px 0',
            background: 'var(--tg-theme-secondary-bg-color)',
            color: 'var(--tg-theme-text-color)',
          }}
        />
      </Card>

      <Card>
        <textarea
          value={description}
          onChange={onDescriptionChange}
          disabled={loading || !canEdit}
          placeholder="Description"
          style={{
            flexGrow: 1,
            padding: '8px 0',
            background: 'var(--tg-theme-secondary-bg-color)',
            color: 'var(--tg-theme-text-color)',
            height: 128,
          }}
        />
      </Card>

      {/* List of examples */}
      {!editId && examples.length > 0 && (
        <Card>
          {examples.map(example => (
            <ExampleListItem
              key={example.id}
              example={example}
              onEdit={onEditItem}
            />
          ))}
        </Card>
      )}

      {/* Delete button (destructive style) */}
      {editId && canEdit && (
        <Block>
          <Button disabled={loading} onClick={onDelete}>
            <span style={{
              color: "var(--text-destructive-color)",
              alignSelf: 'center'
            }}>
              DELETE EXAMPLE
            </span>
          </Button>
        </Block>
      )}

      {/* Telegram closing confirmation (shows if form is dirty) */}
      {shouldShowSaveButton && <ClosingConfirmationController />}

      {/* Telegram main button (bottom action button) */}
      <MainButtonController
        isVisible={shouldShowSaveButton}
        onClick={onSave}
        text={editingExample ? "SAVE" : "CREATE"}
        progress={loading}
      />
    </Page>
  );
});

export default ExampleScreen;

/**
 * Alternative: Component without Model (using Context)
 * Pattern: For components that don't need direct model access
 */
import { UserContext, UsersProviderContext } from "./App";

const UserBadge = React.memo(({ uid }: { uid: number }) => {
  const usersModule = React.useContext(UsersProviderContext);
  const currentUserId = React.useContext(UserContext);
  const user = useVMvalue(usersModule.getUser(uid));

  const isCurrentUser = uid === currentUserId;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      padding: 8,
      backgroundColor: isCurrentUser
        ? 'var(--tg-theme-button-color)'
        : 'var(--tg-theme-secondary-bg-color)',
      color: isCurrentUser
        ? 'var(--tg-theme-button-text-color)'
        : 'var(--tg-theme-text-color)',
      borderRadius: 8,
    }}>
      {user.fullName}
    </div>
  );
});

/**
 * UI Kit Component Example
 * Pattern: Reusable components with inline styles
 */
export const CustomCard = ({
  children,
  title,
  style,
  onClick
}: {
  children: React.ReactNode;
  title?: string;
  style?: React.CSSProperties;
  onClick?: () => void;
}) => {
  return (
    <div
      onClick={onClick}
      className={onClick ? "card" : undefined}
      style={{
        display: 'flex',
        flexDirection: 'column',
        margin: '8px 0',
        padding: '16px',
        backgroundColor: 'var(--tg-theme-secondary-bg-color)',
        borderRadius: 16,
        ...style
      }}
    >
      {title && (
        <div style={{
          fontSize: '0.9em',
          color: 'var(--tg-theme-hint-color)',
          marginBottom: 8,
        }}>
          {title}
        </div>
      )}
      {children}
    </div>
  );
};

/**
 * Best Practices Checklist:
 *
 * ✅ Use WithModel HOC for SessionModel access
 * ✅ Use useVMvalue for reactive state
 * ✅ Use React.useCallback for event handlers
 * ✅ Use React.useMemo for computed values
 * ✅ Use React.memo for list items
 * ✅ Extract sub-components for performance
 * ✅ Use inline styles with Telegram CSS variables
 * ✅ Use BackButtonController for navigation
 * ✅ Use MainButtonController for primary action
 * ✅ Use ClosingConfirmationController for unsaved changes
 * ✅ Use showConfirm for destructive actions
 * ✅ Use useHandleOperation for async operations
 * ✅ Disable inputs during loading
 * ✅ Navigate on success (goBack/goHome)
 * ✅ Use context for cross-cutting concerns
 * ✅ Follow Page > Card > Component structure
 */
