/**
 * ActionButtonsRow Component
 * Displays action buttons for SingleExperience: Plan It, Update Date, Edit Experience, Delete
 *
 * Wrapped with React.memo to prevent unnecessary re-renders when parent state changes
 * that don't affect this component's props.
 */

import { memo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaCalendarAlt, FaPencilAlt, FaTrash, FaShareAlt, FaRobot } from 'react-icons/fa';
import { Box, Flex } from '@chakra-ui/react';
import { FadeIn } from '../../../components/design-system';
import Loading from '../../../components/Loading/Loading';
import { isOwner } from '../../../utilities/permissions';
import { formatDateForInput, formatDateOrdinal } from '../../../utilities/date-utils';
import useButtonWidth from '../../../hooks/useButtonWidth';
import { idEquals } from '../../../utilities/id-utils';
import { useBienBotEntityAction } from '../../../hooks/useBienBotEntityAction';

/* Base styles shared by all action buttons */
const actionButtonBase = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "var(--space-2)",
  px: "var(--space-4)",
  py: "var(--space-2)",
  borderRadius: "var(--btn-radius-default)",
  fontSize: "var(--font-size-sm)",
  fontWeight: "semibold",
  whiteSpace: "nowrap",
  minH: "var(--btn-height-md)",
  borderWidth: "2px",
  borderStyle: "solid",
  borderColor: "transparent",
  cursor: "pointer",
  transition: "all 0.15s ease",
  _hover: {
    transform: "translateY(-2px)",
    boxShadow: "var(--shadow-md)",
  },
  _disabled: {
    opacity: 0.6,
    cursor: "not-allowed",
  },
};

function ActionButtonsRow({
  // User & Experience data
  user,
  experience,
  experienceId,

  // Plan state
  userHasExperience,
  loading,
  plansLoading,
  displayedPlannedDate,
  selectedPlan, // Currently selected plan (for Edit Date button visibility)

  // Button refs and sizing
  planButtonRef,
  planBtnWidth,

  // Hover state
  favHover,
  setFavHover,

  // Handlers
  handleExperience,
  setShowDeleteModal,

  // Date picker state
  showDatePicker,
  setShowDatePicker,
  setIsEditingDate,
  setPlannedDate,

  // Language strings
  lang,

  // Layout variant: "default" | "sidebar"
  variant = "default",

  // Active tab: "experience" | "myplan" - when "myplan", hide planned date in sidebar
  activeTab = "experience",

  // Share handler
  onShare
}) {
  const navigate = useNavigate();

  // Internal ref for button width measurement (always created, used as fallback)
  const internalPlanRef = useRef(null);

  // Use provided ref or fallback to internal ref
  const buttonRef = planButtonRef || internalPlanRef;

  // Check if user owns the selected plan
  const userOwnsSelectedPlan = selectedPlan && idEquals(
    selectedPlan.user?._id || selectedPlan.user,
    user?._id
  );

  // Compute the max width for the plan button using possible text states
  useButtonWidth(buttonRef, [
    lang.current.button.addFavoriteExp,
    lang.current.button.expPlanAdded,
    lang.current.button.removeFavoriteExp
  ], { extraPadding: 12 });

  // BienBot analyze actions (ai_features flag guard)
  const { label: expBienbotLabel, hasAccess: hasBienBot, handleOpen: handleAnalyzeExperience, loading: expBienbotLoading } =
    useBienBotEntityAction('experience', experienceId, experience?.name || 'Experience');
  const { label: planBienbotLabel, handleOpen: handleAnalyzePlan } =
    useBienBotEntityAction('plan', selectedPlan?._id?.toString(), `My ${experience?.name || 'Plan'} plan`);

  // Sidebar variant - vertical stacking with full-width buttons
  if (variant === "sidebar") {
    return (
      <Flex direction="column" align="center" gap="var(--space-3)">
        {/* Primary Action - Plan It / Planned Button */}
        <FadeIn>
          <Box
            as="button"
            {...actionButtonBase}
            minH="52px"
            bg={
              userHasExperience && favHover
                ? "var(--color-danger)"
                : userHasExperience
                  ? "var(--color-success)"
                  : "var(--gradient-primary)"
            }
            color="white"
            fontSize="var(--font-size-base)"
            borderColor={
              userHasExperience && favHover
                ? "var(--color-danger)"
                : "transparent"
            }
            pointerEvents={loading || plansLoading ? "none" : undefined}
            ref={planButtonRef}
            onClick={handleExperience}
            aria-label={
              userHasExperience
                ? lang.current.button.removeFavoriteExp
                : lang.current.button.addFavoriteExp
            }
            aria-pressed={userHasExperience}
            onMouseEnter={() => setFavHover(true)}
            onMouseLeave={() => setFavHover(false)}
            disabled={loading || plansLoading}
            aria-busy={loading || plansLoading}
          >
            {plansLoading ? (
              <Loading size="sm" variant="inline" showMessage={false} />
            ) : userHasExperience ? (
              favHover
                ? lang.current.button.removeFavoriteExp
                : lang.current.button.expPlanAdded
            ) : (
              "Plan This Experience"
            )}
          </Box>
        </FadeIn>

        {/* Planned Date Badge - Only shown when My Plan tab is active (hidden on The Plan/experience tab) */}
        {selectedPlan?.planned_date && activeTab === "myplan" && (
          <FadeIn>
            <Flex justify="center">
              <Box
                {...actionButtonBase}
                bg="var(--gradient-primary)"
                color="white"
                px="var(--space-3)"
                py="var(--space-2)"
                cursor={!userOwnsSelectedPlan ? "default" : "pointer"}
                _hover={!userOwnsSelectedPlan
                  ? { transform: "none", boxShadow: "none" }
                  : { transform: "translateY(-2px)", boxShadow: "var(--shadow-md)" }
                }
                onClick={() => {
                  if (!userOwnsSelectedPlan) return;
                  if (showDatePicker) {
                    setShowDatePicker(false);
                  } else {
                    setIsEditingDate(true);
                    setPlannedDate(formatDateForInput(selectedPlan.planned_date));
                    setShowDatePicker(true);
                  }
                }}
                title={userOwnsSelectedPlan
                  ? (showDatePicker ? "Click to close date picker" : "Click to update planned date")
                  : "Shared plan date (view only)"
                }
              >
                <FaCalendarAlt style={{ fontSize: '1em', flexShrink: 0 }} />
                {formatDateOrdinal(selectedPlan.planned_date)}
              </Box>
            </Flex>
          </FadeIn>
        )}

        {/* Secondary Actions Row */}
        <Flex
          gap={{ base: "var(--space-1)", sm: "var(--space-2)" }}
          justify="center"
          flexWrap="nowrap"
        >
          {/* Edit Date Button - Only shown if user owns the selected plan and on My Plan tab */}
          {userOwnsSelectedPlan && activeTab === "myplan" && (
            <FadeIn>
              <Box
                as="button"
                {...actionButtonBase}
                bg="var(--color-bg-primary)"
                color="var(--color-text-primary)"
                borderColor="var(--color-border-medium)"
                minW="44px"
                px="var(--space-3)"
                py="var(--space-2)"
                _hover={{
                  transform: "translateY(-2px)",
                  boxShadow: "var(--shadow-md)",
                  bg: "var(--color-bg-hover)",
                  borderColor: "var(--color-border-dark)",
                }}
                onClick={() => {
                  if (showDatePicker) {
                    setShowDatePicker(false);
                  } else {
                    setIsEditingDate(true);
                    setPlannedDate(
                      selectedPlan.planned_date
                        ? formatDateForInput(selectedPlan.planned_date)
                        : ""
                    );
                    setShowDatePicker(true);
                  }
                }}
                aria-label={lang.current.button.editDate}
                title={showDatePicker
                  ? "Click to close date picker"
                  : (selectedPlan.planned_date
                      ? "Click to update planned date"
                      : "Click to add planned date")
                }
              >
                <FaCalendarAlt />
              </Box>
            </FadeIn>
          )}

          {/* Share Button */}
          {onShare && (
            <FadeIn>
              <Box
                as="button"
                {...actionButtonBase}
                bg="var(--color-bg-primary)"
                color="var(--color-info)"
                borderColor="var(--color-info)"
                minW="44px"
                px="var(--space-3)"
                py="var(--space-2)"
                _hover={{
                  transform: "translateY(-2px)",
                  boxShadow: "var(--shadow-md)",
                  bg: "var(--color-info)",
                  color: "white",
                  borderColor: "var(--color-info)",
                }}
                onClick={onShare}
                aria-label={lang.current.button.share}
                title={lang.current.button.share}
              >
                <FaShareAlt />
              </Box>
            </FadeIn>
          )}

          {/* BienBot: Discuss Plan when plan is in focus, else Analyze Experience */}
          {user && hasBienBot && (
            <FadeIn>
              <Box
                as="button"
                {...actionButtonBase}
                bg="var(--color-bg-primary)"
                color="var(--color-text-primary)"
                borderColor="var(--color-border-medium)"
                minW="44px"
                px="var(--space-3)"
                py="var(--space-2)"
                _hover={{
                  transform: "translateY(-2px)",
                  boxShadow: "var(--shadow-md)",
                  bg: "var(--color-bg-hover)",
                  borderColor: "var(--color-border-dark)",
                }}
                onClick={activeTab === "myplan" && selectedPlan ? handleAnalyzePlan : handleAnalyzeExperience}
                aria-label={activeTab === "myplan" && selectedPlan ? `${planBienbotLabel} Plan with BienBot` : `${expBienbotLabel} with BienBot`}
                title={activeTab === "myplan" && selectedPlan ? `${planBienbotLabel} Plan with BienBot` : `${expBienbotLabel} with BienBot`}
              >
                <FaRobot />
              </Box>
            </FadeIn>
          )}

          {/* Edit & Delete Buttons - Only shown if user is owner */}
          {isOwner(user, experience) && (
            <>
              <FadeIn>
                <Box
                  as="button"
                  {...actionButtonBase}
                  bg="var(--color-bg-primary)"
                  color="var(--color-text-primary)"
                  borderColor="var(--color-border-medium)"
                  minW="44px"
                  px="var(--space-3)"
                  py="var(--space-2)"
                  _hover={{
                    transform: "translateY(-2px)",
                    boxShadow: "var(--shadow-md)",
                    bg: "var(--color-bg-hover)",
                    borderColor: "var(--color-border-dark)",
                  }}
                  onClick={() => navigate(`/experiences/${experienceId}/update`)}
                  aria-label={lang.current.button.updateExperience}
                  title={lang.current.button.updateExperience}
                >
                  <FaPencilAlt />
                </Box>
              </FadeIn>
              <FadeIn>
                <Box
                  as="button"
                  {...actionButtonBase}
                  bg="var(--color-bg-primary)"
                  color="var(--color-danger)"
                  borderColor="var(--color-danger)"
                  minW="44px"
                  px="var(--space-3)"
                  py="var(--space-2)"
                  _hover={{
                    transform: "translateY(-2px)",
                    boxShadow: "var(--shadow-md)",
                    bg: "var(--color-danger-light)",
                    borderColor: "var(--color-danger)",
                  }}
                  onClick={() => setShowDeleteModal(true)}
                  aria-label={lang.current.button.delete}
                  title={lang.current.button.delete}
                >
                  <FaTrash />
                </Box>
              </FadeIn>
            </>
          )}
        </Flex>

      </Flex>
    );
  }

  // Default variant - horizontal row layout
  return (
    <Flex
      className="col-md-6"
      align="center"
      justify={{ base: "center", md: "flex-end" }}
      gap={{ base: "var(--space-1)", md: "var(--space-2)" }}
      flexWrap="nowrap"
    >
      {/* Plan It / Planned Button */}
      <FadeIn>
        <Box
          as="button"
          {...actionButtonBase}
          bg={
            userHasExperience && favHover
              ? "var(--color-danger)"
              : userHasExperience
                ? "var(--color-success)"
                : "var(--gradient-primary)"
          }
          color="white"
          borderColor={
            userHasExperience && favHover
              ? "var(--color-danger)"
              : userHasExperience
                ? "var(--color-success)"
                : "transparent"
          }
          pointerEvents={loading || plansLoading ? "none" : undefined}
          ref={planButtonRef}
          onClick={handleExperience}
          aria-label={
            userHasExperience
              ? lang.current.button.removeFavoriteExp
              : lang.current.button.addFavoriteExp
          }
          aria-pressed={userHasExperience}
          onMouseEnter={() => setFavHover(true)}
          onMouseLeave={() => setFavHover(false)}
          disabled={loading || plansLoading}
          aria-busy={loading || plansLoading}
        >
          {plansLoading ? (
            <Loading size="sm" variant="inline" showMessage={false} />
          ) : userHasExperience ? (
            favHover
              ? lang.current.button.removeFavoriteExp
              : lang.current.button.expPlanAdded
          ) : (
            lang.current.button.addFavoriteExp
          )}
        </Box>
      </FadeIn>

      {/* Planned Date Badge - Between Plan It and action buttons - Only shown on My Plan tab */}
      {selectedPlan?.planned_date && activeTab === "myplan" && (
        <FadeIn>
          <Box
            {...actionButtonBase}
            bg="var(--gradient-primary)"
            color="white"
            px="var(--space-3)"
            py="var(--space-2)"
            cursor={!userOwnsSelectedPlan ? "default" : "pointer"}
            _hover={!userOwnsSelectedPlan
              ? { transform: "none", boxShadow: "none" }
              : { transform: "translateY(-2px)", boxShadow: "var(--shadow-md)" }
            }
            onClick={() => {
              if (!userOwnsSelectedPlan) return;
              if (showDatePicker) {
                setShowDatePicker(false);
              } else {
                setIsEditingDate(true);
                setPlannedDate(formatDateForInput(selectedPlan.planned_date));
                setShowDatePicker(true);
              }
            }}
            title={userOwnsSelectedPlan
              ? (showDatePicker ? "Click to close date picker" : "Click to update planned date")
              : "Shared plan date (view only)"
            }
          >
            <FaCalendarAlt style={{ fontSize: '1em', flexShrink: 0 }} />
            {formatDateOrdinal(selectedPlan.planned_date)}
          </Box>
        </FadeIn>
      )}

      {/* Edit Date Button - Only shown if user owns the selected plan and on My Plan tab */}
      {userOwnsSelectedPlan && activeTab === "myplan" && (
        <FadeIn>
          <Box
            as="button"
            {...actionButtonBase}
            bg="var(--color-bg-primary)"
            color="var(--color-text-primary)"
            borderColor="var(--color-border-medium)"
            minW="44px"
            px="var(--space-3)"
            py="var(--space-2)"
            _hover={{
              transform: "translateY(-2px)",
              boxShadow: "var(--shadow-md)",
              bg: "var(--color-bg-hover)",
              borderColor: "var(--color-border-dark)",
            }}
            onClick={() => {
              if (showDatePicker) {
                setShowDatePicker(false);
              } else {
                setIsEditingDate(true);
                setPlannedDate(
                  selectedPlan.planned_date
                    ? formatDateForInput(selectedPlan.planned_date)
                    : ""
                );
                setShowDatePicker(true);
              }
            }}
            aria-label={lang.current.button.editDate}
            title={showDatePicker
              ? "Click to close date picker"
              : (selectedPlan.planned_date
                  ? "Click to update planned date"
                  : "Click to add planned date")
            }
          >
            <FaCalendarAlt />
          </Box>
        </FadeIn>
      )}

      {/* Share Button */}
      {onShare && (
        <FadeIn>
          <Box
            as="button"
            {...actionButtonBase}
            bg="var(--color-bg-primary)"
            color="var(--color-info)"
            borderColor="var(--color-info)"
            minW="44px"
            px="var(--space-3)"
            py="var(--space-2)"
            _hover={{
              transform: "translateY(-2px)",
              boxShadow: "var(--shadow-md)",
              bg: "var(--color-info)",
              color: "white",
              borderColor: "var(--color-info)",
            }}
            onClick={onShare}
            aria-label={lang.current.button.share}
            title={lang.current.button.share}
          >
            <FaShareAlt />
          </Box>
        </FadeIn>
      )}

      {/* Edit & Delete Buttons - Only shown if user is owner */}
      {isOwner(user, experience) && (
        <>
          <FadeIn>
            <Box
              as="button"
              {...actionButtonBase}
              bg="var(--color-bg-primary)"
              color="var(--color-text-primary)"
              borderColor="var(--color-border-medium)"
              minW="44px"
              px="var(--space-3)"
              py="var(--space-2)"
              _hover={{
                transform: "translateY(-2px)",
                boxShadow: "var(--shadow-md)",
                bg: "var(--color-bg-hover)",
                borderColor: "var(--color-border-dark)",
              }}
              onClick={() => navigate(`/experiences/${experienceId}/update`)}
              aria-label={lang.current.button.updateExperience}
              title={lang.current.button.updateExperience}
            >
              <FaPencilAlt />
            </Box>
          </FadeIn>
          <FadeIn>
            <Box
              as="button"
              {...actionButtonBase}
              bg="var(--color-bg-primary)"
              color="var(--color-danger)"
              borderColor="var(--color-danger)"
              minW="44px"
              px="var(--space-3)"
              py="var(--space-2)"
              _hover={{
                transform: "translateY(-2px)",
                boxShadow: "var(--shadow-md)",
                bg: "var(--color-danger-light)",
                borderColor: "var(--color-danger)",
              }}
              onClick={() => setShowDeleteModal(true)}
              aria-label={lang.current.button.delete}
              title={lang.current.button.delete}
            >
              <FaTrash />
            </Box>
          </FadeIn>
        </>
      )}

      {/* BienBot: Discuss Plan when plan is in focus, else Analyze Experience */}
      {user && hasBienBot && (
        <FadeIn>
          <Box
            as="button"
            {...actionButtonBase}
            bg="var(--color-bg-primary)"
            color="var(--color-text-primary)"
            borderColor="var(--color-border-medium)"
            minW="44px"
            px="var(--space-3)"
            py="var(--space-2)"
            _hover={{
              transform: "translateY(-2px)",
              boxShadow: "var(--shadow-md)",
              bg: "var(--color-bg-hover)",
              borderColor: "var(--color-border-dark)",
            }}
            onClick={activeTab === "myplan" && selectedPlan ? handleAnalyzePlan : handleAnalyzeExperience}
            disabled={expBienbotLoading}
            aria-label={activeTab === "myplan" && selectedPlan ? `${planBienbotLabel} Plan with BienBot` : `${expBienbotLabel} with BienBot`}
            title={activeTab === "myplan" && selectedPlan ? `${planBienbotLabel} Plan with BienBot` : `${expBienbotLabel} with BienBot`}
          >
            {expBienbotLoading
              ? <Loading size="xs" variant="inline" showMessage={false} />
              : <FaRobot />
            }
          </Box>
        </FadeIn>
      )}
    </Flex>
  );
}

export default memo(ActionButtonsRow);
